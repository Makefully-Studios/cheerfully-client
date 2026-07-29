# Changelog

## 1.14.0

- Add `sharp` service client for image convert/compress/resize, thumbnails, and favicon packs.
- Add `stackfully` service client for multi-layer image compositing.

## 1.13.1

- Harden `say` / ElevenLabs export when the result zip has no MP3 (clearer error, no unhandled ENOENT from ID3 metadata).

## 1.13.0

- Add `packfully` service client for packing images into texture atlases.

## 1.12.1

- Preserve optional script-line `events` through Transcript for timed marker definitions.

## 1.12.0

- Treat missing `src`/`output` directories as empty instead of failing; create output directories when writing.

## 1.11.0

- Preserve optional script-line `class` through transcription for VTT cue classes, SAMI spans, and JSON caption output.

## 1.10.1

- Publish as `@makefully/dutifully` on npm with trusted publishing support.
