- source_spec: none
  summary: Integrate the sign-language interpreter with Zoom and/or Google Meet.
  evidence: Meeting-platform integration is independently shippable and depends on first validating and repairing the core interpreter.
- source_spec: `_bmad-output/implementation-artifacts/spec-audit-repair-sign-language-interpreter.md`
  summary: Migrate the frontend away from the unmaintained Create React App toolchain and refresh its test dependencies.
  evidence: Passing tests and builds emit ReactDOM test-utils, Babel preset, and outdated Browserslist warnings from the pre-existing frontend toolchain.
