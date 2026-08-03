/**
 * GIF Comment Extension helpers for Cheerfully hash maps (lossless).
 * Comment text: CheerfullyHashes:{"CheerfullySharpHash":"..."}.
 */
const
    MAP_MARKER = 'CheerfullyHashes:',
    parseHashesFromComment = (text) => {
        if (!text || typeof text !== 'string') {
            return {};
        }
        const
            idx = text.indexOf(MAP_MARKER);

        if (idx < 0) {
            return {};
        }
        try {
            return JSON.parse(text.slice(idx + MAP_MARKER.length)) || {};
        } catch (e) {
            return {};
        }
    },
    serializeHashesComment = (hashes) => `${MAP_MARKER}${JSON.stringify(hashes || {})}`,
    isGif = (buffer) => {
        if (!buffer || buffer.length < 6) {
            return false;
        }
        const
            sig = buffer.slice(0, 6).toString('ascii');

        return sig === 'GIF87a' || sig === 'GIF89a';
    },
    /**
     * Read sub-blocks starting at offset (first byte is block size).
     * @returns {{data: Buffer, next: number}}
     */
    readSubBlocks = (buffer, offset) => {
        const
            chunks = [];

        let
            pos = offset;

        while (pos < buffer.length) {
            const
                size = buffer[pos];

            pos += 1;
            if (size === 0) {
                break;
            }
            if (pos + size > buffer.length) {
                throw new Error('Truncated GIF sub-blocks');
            }
            chunks.push(buffer.slice(pos, pos + size));
            pos += size;
        }
        return {data: Buffer.concat(chunks), next: pos};
    },
    encodeCommentExtension = (text) => {
        const
            bytes = Buffer.from(text, 'utf8'),
            parts = [Buffer.from([0x21, 0xfe])];

        for (let i = 0; i < bytes.length; i += 255) {
            const
                chunk = bytes.slice(i, i + 255);

            parts.push(Buffer.from([chunk.length]), chunk);
        }
        parts.push(Buffer.from([0x00]));
        return Buffer.concat(parts);
    },
    /**
     * Collect Cheerfully hash comments; return all comments' ranges for rewrite.
     */
    scanGifComments = (buffer) => {
        if (!isGif(buffer)) {
            throw new Error('Not a GIF buffer');
        }

        let
            offset = 6; // skip signature

        const
            packed = buffer[offset + 4];

        offset += 7; // logical screen descriptor
        if (packed & 0x80) {
            offset += 3 * (2 ** ((packed & 0x07) + 1));
        }

        const
            comments = [],
            cheerfully = [];

        while (offset < buffer.length) {
            const
                marker = buffer[offset];

            if (marker === 0x3b) {
                return {comments, cheerfully, trailerAt: offset};
            }

            if (marker === 0x21) {
                const
                    start = offset,
                    label = buffer[offset + 1],
                    {data, next} = readSubBlocks(buffer, offset + 2),
                    text = data.toString('utf8');

                comments.push({start, end: next, label, text});
                if (label === 0xfe && text.includes(MAP_MARKER)) {
                    cheerfully.push({start, end: next, text});
                }
                offset = next;
                continue;
            }

            if (marker === 0x2c) {
                // Image descriptor: 10 bytes header after marker, then optional LCT, then LZW + sub-blocks
                if (offset + 10 > buffer.length) {
                    throw new Error('Truncated GIF image descriptor');
                }
                const
                    localPacked = buffer[offset + 9];

                offset += 10;
                if (localPacked & 0x80) {
                    offset += 3 * (2 ** ((localPacked & 0x07) + 1));
                }
                // LZW minimum code size
                offset += 1;
                ({next: offset} = readSubBlocks(buffer, offset));
                continue;
            }

            throw new Error(`Unexpected GIF block 0x${marker.toString(16)} at ${offset}`);
        }

        throw new Error('GIF missing trailer');
    },
    readGifHashes = (buffer) => {
        const
            {cheerfully} = scanGifComments(buffer);

        if (!cheerfully.length) {
            return {};
        }
        // Last cheerfully comment wins (in case of duplicates)
        return parseHashesFromComment(cheerfully[cheerfully.length - 1].text);
    },
    writeGifHashes = (buffer, hashes) => {
        const
            {cheerfully, trailerAt} = scanGifComments(buffer),
            comment = encodeCommentExtension(serializeHashesComment(hashes)),
            ranges = cheerfully.slice().sort((a, b) => a.start - b.start),
            parts = [];

        let
            cursor = 0,
            removedBeforeTrailer = 0;

        for (const range of ranges) {
            parts.push(buffer.slice(cursor, range.start));
            cursor = range.end;
            if (range.end <= trailerAt) {
                removedBeforeTrailer += range.end - range.start;
            }
        }

        const
            kept = Buffer.concat([...parts, buffer.slice(cursor)]),
            trailerIdx = trailerAt - removedBeforeTrailer;

        return Buffer.concat([
            kept.slice(0, trailerIdx),
            comment,
            kept.slice(trailerIdx)
        ]);
    };

module.exports = {
    MAP_MARKER,
    parseHashesFromComment,
    serializeHashesComment,
    readGifHashes,
    writeGifHashes,
    isGif
};
