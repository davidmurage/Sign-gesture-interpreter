import { fireEvent, render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from './HomePage';

let mockWebcamProps;
let mockScreenshot = 'data:image/jpeg;base64,abc';
const mockStopTrack = jest.fn();
jest.mock('react-webcam', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => {
    mockWebcamProps = props;
    React.useImperativeHandle(ref, () => ({
      getScreenshot: () => mockScreenshot,
      video: { srcObject: { getTracks: () => [{ stop: mockStopTrack }] } },
    }));
    return <div data-testid="webcam" />;
  });
});
jest.mock('./../components/Layout/Layout', () => ({ children }) => <div>{children}</div>);

const originalFetch = global.fetch;
const response = (data, ok = true) => ({ ok, json: async () => data });
const noHand = { handDetected: false, label: null, text: null, confidence: null, error: null };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const start = async () => {
  fireEvent.click(screen.getByText('Start Camera'));
  await act(async () => mockWebcamProps.onUserMedia());
};

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
  mockScreenshot = 'data:image/jpeg;base64,abc';
  mockStopTrack.mockClear();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  global.fetch = originalFetch;
});

test('starts after permission and stops camera resources', async () => {
  global.fetch.mockResolvedValue(response(noHand));
  render(<HomePage />);
  fireEvent.click(screen.getByText('Start Camera'));
  expect(screen.getByText('Requesting camera permission...')).toBeInTheDocument();
  await act(async () => mockWebcamProps.onUserMedia());
  expect(global.fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Stop Camera'));
  expect(mockStopTrack).toHaveBeenCalled();
  expect(screen.getByText('Camera is stopped.')).toBeInTheDocument();
});

test('denial performs cleanup without polling', () => {
  render(<HomePage />);
  fireEvent.click(screen.getByText('Start Camera'));
  act(() => mockWebcamProps.onUserMediaError());
  expect(screen.getByText(/Camera access was denied/)).toBeInTheDocument();
  expect(mockStopTrack).toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('clears stale output when no hand is detected', async () => {
  global.fetch.mockResolvedValueOnce(response({ handDetected: true, label: 'A', text: 'A', confidence: 80, error: null }))
    .mockResolvedValueOnce(response(noHand));
  render(<HomePage />);
  await start();
  expect(screen.getByText(/A \(80.00%\)/)).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(1000); await Promise.resolve(); });
  expect(screen.getByText('No hand detected.')).toBeInTheDocument();
  expect(screen.queryByText(/80.00%/)).not.toBeInTheDocument();
});

test('does not overlap requests and reports connectivity failure', async () => {
  const pending = deferred();
  global.fetch.mockReturnValue(pending.promise);
  render(<HomePage />);
  await start();
  act(() => jest.advanceTimersByTime(5000));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await act(async () => pending.reject(new Error('offline')));
  expect(screen.getByText(/inference service is unavailable/)).toBeInTheDocument();
  const retry = deferred();
  global.fetch.mockReturnValueOnce(retry.promise);
  act(() => jest.advanceTimersByTime(1000));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('Stop Camera'));
});

test('Stop and unmount abort an in-flight request and prevent late retry', async () => {
  const pending = deferred();
  global.fetch.mockReturnValue(pending.promise);
  const { unmount } = render(<HomePage />);
  await start();
  const signal = global.fetch.mock.calls[0][1].signal;
  fireEvent.click(screen.getByText('Stop Camera'));
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(response({ handDetected: true, text: 'late', confidence: 99 })));
  act(() => jest.advanceTimersByTime(10000));
  expect(global.fetch).toHaveBeenCalledTimes(1);

  const next = deferred();
  global.fetch.mockReturnValue(next.promise);
  await start();
  const nextSignal = global.fetch.mock.calls[1][1].signal;
  unmount();
  expect(nextSignal.aborted).toBe(true);
});

test('late completion from an old session cannot corrupt a restarted session', async () => {
  const old = deferred();
  global.fetch.mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response({ handDetected: true, text: 'new', label: 'B', confidence: 88 }));
  render(<HomePage />);
  await start();
  fireEvent.click(screen.getByText('Stop Camera'));
  await start();
  expect(screen.getByText(/new \(88.00%\)/)).toBeInTheDocument();
  await act(async () => old.resolve(response({ handDetected: true, text: 'old', confidence: 99 })));
  expect(screen.queryByText(/old/)).not.toBeInTheDocument();
});

test('repeated onUserMedia and null screenshots do not duplicate requests', async () => {
  mockScreenshot = null;
  global.fetch.mockResolvedValue(response(noHand));
  render(<HomePage />);
  fireEvent.click(screen.getByText('Start Camera'));
  act(() => { mockWebcamProps.onUserMedia(); mockWebcamProps.onUserMedia(); });
  expect(global.fetch).not.toHaveBeenCalled();
  mockScreenshot = 'data:image/jpeg;base64,abc';
  await act(async () => jest.advanceTimersByTime(1000));
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('malformed successful response is a protocol error', async () => {
  global.fetch.mockResolvedValue(response({ handDetected: true, text: null, label: null }));
  render(<HomePage />);
  await start();
  expect(screen.getByText(/invalid response/)).toBeInTheDocument();
});

test('aborts a request at the timeout and retries only after it settles', async () => {
  global.fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () =>
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }));
  render(<HomePage />);
  await start();
  await act(async () => { jest.advanceTimersByTime(8000); await Promise.resolve(); });
  expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(screen.getByText(/timed out/)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(1000));
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('KSL mode discloses vocabulary and sends a temporal session', async () => {
  global.fetch.mockResolvedValue(response({ handDetected: false, label: null, text: null,
    confidence: null, error: null, provider: 'ksl-experimental',
    status: 'warming-up', progress: 1 }));
  render(<HomePage />);
  fireEvent.change(screen.getByLabelText('Recognition mode'),
    { target: { value: 'ksl-experimental' } });
  expect(screen.getByText('Experimental Kenyan Sign Language Interpreter')).toBeInTheDocument();
  expect(screen.getByText(/Accuracy across different signers/)).toBeInTheDocument();
  await start();
  const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(payload.provider).toBe('ksl-experimental');
  expect(payload.sessionId).toMatch(/^web-/);
  expect(screen.getByText(/Collecting a KSL sequence \(1\/30 frames\)/)).toBeInTheDocument();
  expect(screen.getByLabelText('Recognition mode')).toBeDisabled();
  act(() => jest.advanceTimersByTime(99));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(1); await Promise.resolve(); });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
