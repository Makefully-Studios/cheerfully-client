# Changelog

## Unreleased

## 1.20.0

- Add `translate` client for Amazon Translate (Cheerfully script JSON or language-matrix CSV/TSV).
- Support `ignore` for phrases left untranslated.

## 1.19.0

- Authenticate Showfully yap chores with `Authorization: Bearer` and `POST /yap/:service` (token no longer in the URL path).

## 1.18.0

- Store GIF content hashes in a Comment Extension (`CheerfullyHashes:{...}`), lossless.

## 1.17.0

- Store JPEG/WebP/TIFF/AVIF content hashes in embedded XMP (`cheerfully:hashes`) instead of EXIF `ImageDescription`, so they no longer appear as Windows Title/Subject.
- Rename `ExifImage` → `XmpImage`; keep PNG on `tEXt` keywords.
- Reject non-zip Cheerfully responses with a readable preview instead of crashing inside `unzip-stream`.
- Surface chore `errors` as hard failures while polling status.
- Run multi-config services sequentially and catch per-job failures (`for`/`await` instead of fire-and-forget `forEach`).
- Document Sharp `extract` (center cutout) for favicon packs.

## 1.16.0

- Add `classfully` service client for approximating images as CSS class rules.

## 1.15.0

- Skip unchanged Sharp, Packfully, and Stackfully image outputs via embedded per-service metadata hashes (`CheerfullySharpHash`, `CheerfullyPackfullyHash`, `CheerfullyStackfullyHash`).
- Add shared image hash embedders (PNG tEXt, JPEG/WebP/TIFF/AVIF EXIF); unsupported types (e.g. ICO, GIF) always reprocess with a console note.

## 1.14.1

- Upgrade `archiver` so `directory()` works when a modern `glob` is hoisted (fixes `TypeError: glob is not a function`).

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
