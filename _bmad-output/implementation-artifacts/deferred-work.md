- source_spec: none
  summary: Integrate the sign-language interpreter with Zoom and/or Google Meet.
  evidence: Meeting-platform integration is independently shippable and depends on first validating and repairing the core interpreter.
- source_spec: `_bmad-output/implementation-artifacts/spec-audit-repair-sign-language-interpreter.md`
  summary: Migrate the frontend away from the unmaintained Create React App toolchain and refresh its test dependencies.
  evidence: Passing tests and builds emit ReactDOM test-utils, Babel preset, and outdated Browserslist warnings from the pre-existing frontend toolchain.
- source_spec: `_bmad-output/implementation-artifacts/spec-meeting-local-overlay-zoom-google-meet.md`
  summary: Publish recognized gesture text into Zoom and Google Meet chat.
  evidence: Meeting-chat publishing requires platform-specific permissions and app registration, so it was split from the shared local overlay foundation.
- source_spec: `_bmad-output/implementation-artifacts/spec-meeting-local-overlay-zoom-google-meet.md`
  summary: Publish recognized gesture text as live captions to Zoom and Google Meet participants.
  evidence: Participant-visible captions require separate platform capabilities and host/admin permissions, so they were split from the shared local overlay foundation.
