from flask import Flask, jsonify, request
from flask_cors import CORS
import cv2
import mediapipe as mp
import numpy as np
import math
import tensorflow as tf
import threading
import base64
from io import BytesIO
from PIL import Image
import re
from collections import deque

app = Flask(__name__)
CORS(app)

class CustomDepthwiseConv2D(tf.keras.layers.DepthwiseConv2D):
    def __init__(self, **kwargs):
        if 'groups' in kwargs:
            kwargs.pop('groups')
            
        super().__init__(**kwargs)

tf.keras.utils.get_custom_objects()['DepthwiseConv2D'] = CustomDepthwiseConv2D

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=1)
mp_drawing = mp.solutions.drawing_utils

model = tf.keras.models.load_model("Model/keras_model.h5")

with open("Model/labels.txt", "r") as f:
    labels = f.read().strip().split('\n')

cap = None
running = False

# Buffer to store last N predictions
PREDICTION_BUFFER_SIZE = 10
prediction_buffer = deque(maxlen=PREDICTION_BUFFER_SIZE)

@app.route('/start', methods=['POST'])
def start_camera():
    global cap, running
    if not running:
        cap = cv2.VideoCapture(0)
        running = True
        threading.Thread(target=process_frame).start()
        return jsonify({'message': 'Camera started'}), 200
    return jsonify({'message': 'Camera already running'}), 200

@app.route('/stop', methods=['POST'])
def stop_camera():
    global cap, running
    if running:
        running = False
        if cap and cap.isOpened():
            cap.release()
        return jsonify({'message': 'Camera stopped'}), 200
    return jsonify({'message': 'Camera not running'}), 200

def process_frame():
    global cap, running
    while running:
        success, img = cap.read()
        if not success:
            continue

        imgOutput = img.copy()
        imgRGB = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = hands.process(imgRGB)
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                h, w, c = img.shape
                x_min, y_min = w, h
                x_max, y_max = 0, 0
                
                for lm in hand_landmarks.landmark:
                    x, y = int(lm.x * w), int(lm.y * h)
                    x_min, x_max = min(x_min, x), max(x_max, x)
                    y_min, y_max = min(y_min, y), max(y_max, y)
                
                x = max(0, x_min - 20)
                y = max(0, y_min - 20)
                w = min(img.shape[1], x_max - x_min + 40)
                h = min(img.shape[0], y_max - y_min + 40)

                imgWhite = np.ones((300, 300, 3), np.uint8) * 255
                imgCrop = img[y:y + h, x:x + w]
                aspectRatio = h / w

                if (aspectRatio > 1):
                    k = 300 / h
                    wCal = math.ceil(k * w)
                    imgResize = cv2.resize(imgCrop, (wCal, 300))
                    wGap = math.ceil((300 - wCal) / 2)
                    imgWhite[:, wGap: wCal + wGap] = imgResize
                else:
                    k = 300 / w
                    hCal = math.ceil(k * h)
                    imgResize = cv2.resize(imgCrop, (300, hCal))
                    hGap = math.ceil((300 - hCal) / 2)
                    imgWhite[hGap: hCal + hGap, :] = imgResize

                imgWhite_resized = cv2.resize(imgWhite, (224, 224))
                imgWhite_resized = imgWhite_resized / 255.0
                imgWhite_resized = np.expand_dims(imgWhite_resized, axis=0)

                prediction = model.predict(imgWhite_resized)
                index = np.argmax(prediction)
                confidence = prediction[0][index] * 100  # Convert to percentage
                prediction_buffer.append(index)
                most_common_prediction = max(set(prediction_buffer), key=prediction_buffer.count)
                most_common_confidence = prediction[0][most_common_prediction] * 100

                cv2.rectangle(imgOutput, (x-20, y-90), (x+380, y-50), (0, 255, 0), cv2.FILLED)
                cv2.putText(imgOutput, f'{labels[most_common_prediction]} {most_common_confidence:.2f}%', (x, y-30), cv2.FONT_HERSHEY_COMPLEX, 2, (0, 0, 0), 2)
                cv2.rectangle(imgOutput, (x-20, y-20), (x + w + 20, y + h + 20), (0, 255, 0), 4)
                
                mp_drawing.draw_landmarks(imgOutput, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                cv2.imshow('Image', imgOutput)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    cv2.destroyAllWindows()

@app.route('/interpret', methods=['POST'])
def interpret():
    data = request.get_json()
    image_data = re.sub('^data:image/.+;base64,', '', data['image'])
    image = Image.open(BytesIO(base64.b64decode(image_data)))
    image = np.array(image)
    imgRGB = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = hands.process(imgRGB)

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            h, w, c = image.shape
            x_min, y_min = w, h
            x_max, y_max = 0, 0

            for lm in hand_landmarks.landmark:
                x, y = int(lm.x * w), int(lm.y * h)
                x_min, x_max = min(x_min, x), max(x_max, x)
                y_min, y_max = min(y_min, y), max(y_max, y)

            x = max(0, x_min - 20)
            y = max(0, y_min - 20)
            w = min(image.shape[1], x_max - x_min + 40)
            h = min(image.shape[0], y_max - y_min + 40)

            imgWhite = np.ones((300, 300, 3), np.uint8) * 255
            imgCrop = image[y:y + h, x:x + w]
            aspectRatio = h / w

            if (aspectRatio > 1):
                k = 300 / h
                wCal = math.ceil(k * w)
                imgResize = cv2.resize(imgCrop, (wCal, 300))
                wGap = math.ceil((300 - wCal) / 2)
                imgWhite[:, wGap: wCal + wGap] = imgResize
            else:
                k = 300 / w
                hCal = math.ceil(k * h)
                imgResize = cv2.resize(imgCrop, (300, hCal))
                hGap = math.ceil((300 - hCal) / 2)
                imgWhite[hGap: hCal + hGap, :] = imgResize

            imgWhite_resized = cv2.resize(imgWhite, (224, 224))
            imgWhite_resized = imgWhite_resized / 255.0
            imgWhite_resized = np.expand_dims(imgWhite_resized, axis=0)

            prediction = model.predict(imgWhite_resized)
            index = np.argmax(prediction)
            confidence = prediction[0][index] * 100  # Convert to percentage
            prediction_buffer.append(index)
            most_common_prediction = max(set(prediction_buffer), key=prediction_buffer.count)
            most_common_confidence = prediction[0][most_common_prediction] * 100
            
            # Integrate NLP processing here
            interpreted_text = convert_to_text(labels[most_common_prediction])
            
            return jsonify({'interpretedText': interpreted_text, 'confidence': most_common_confidence}), 200
    return jsonify({'interpretedText': 'No hand detected'}), 200

def convert_to_text(gesture_label):
    # This function converts a gesture label to text using NLP logic or predefined mappings.
    # Example: converting gesture labels to words or sentences
    gesture_to_text = {
        'Hello': 'Hello there!',
        'Yes': 'Yes, I agree.',
        'No': 'No, I disagree.',
        'Thank you': 'Thank you very much.',
        # Add more mappings as needed
    }
    return gesture_to_text.get(gesture_label, 'Gesture not recognized')

if __name__ == '__main__':
    app.run(debug=True)
