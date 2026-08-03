/**
 * Shared Cheerfully hash map in embedded XMP (custom namespace).
 * PNG keeps tEXt; GIF uses Comment Extension; JPEG/WebP/TIFF/AVIF use this packet.
 */
const
    NS = 'https://makefullystudios.com/ns/cheerfully/1.0/',
    NS_PREFIX = 'cheerfully',
    PROP = 'hashes',
    // JPEG APP1 XMP identification (null-terminated)
    JPEG_XMP_NAMESPACE = 'http://ns.adobe.com/xap/1.0/\0',
    escapeXml = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;'),
    unescapeXml = (value) => String(value)
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'),
    attrPattern = () => new RegExp(
        `${NS_PREFIX}:${PROP}\\s*=\\s*"([^"]*)"`,
        'i'
    ),
    parseHashesFromXmp = (xmp) => {
        if (!xmp) {
            return {};
        }
        const
            text = Buffer.isBuffer(xmp) ? xmp.toString('utf8') : String(xmp),
            match = text.match(attrPattern());

        if (!match) {
            return {};
        }
        try {
            return JSON.parse(unescapeXml(match[1])) || {};
        } catch (e) {
            return {};
        }
    },
    buildXmpPacket = (hashes) => {
        const
            json = escapeXml(JSON.stringify(hashes || {}));

        return [
            '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>',
            '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
            ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
            '  <rdf:Description rdf:about=""',
            `    xmlns:${NS_PREFIX}="${NS}"`,
            `    ${NS_PREFIX}:${PROP}="${json}"/>`,
            ' </rdf:RDF>',
            '</x:xmpmeta>',
            '<?xpacket end="w"?>'
        ].join('\n');
    },
    /**
     * Merge cheerfully:hashes into existing XMP, or build a fresh packet.
     * Replaces a prior cheerfully:hashes attribute when present.
     */
    injectHashesIntoXmp = (existingXmp, hashes) => {
        const
            packet = existingXmp
                ? (Buffer.isBuffer(existingXmp) ? existingXmp.toString('utf8') : String(existingXmp))
                : '',
            json = escapeXml(JSON.stringify(hashes || {}));

        if (!packet.trim()) {
            return buildXmpPacket(hashes);
        }

        if (attrPattern().test(packet)) {
            return packet.replace(attrPattern(), `${NS_PREFIX}:${PROP}="${json}"`);
        }

        // Inject xmlns + attribute onto first rdf:Description (keep /> if self-closing)
        if (/<rdf:Description\b[^>]*\/?>/i.test(packet)) {
            return packet.replace(/<rdf:Description\b([^>]*?)(\/?)>/i, (full, attrs, selfClose) => {
                let
                    next = attrs;

                if (!new RegExp(`xmlns:${NS_PREFIX}=`, 'i').test(next)) {
                    next += ` xmlns:${NS_PREFIX}="${NS}"`;
                }
                next += ` ${NS_PREFIX}:${PROP}="${json}"`;
                return `<rdf:Description${next}${selfClose}>`;
            });
        }

        // Fallback: replace whole packet (keeps our hashes readable)
        return buildXmpPacket(hashes);
    },
    /**
     * Lossless JPEG: find/replace/insert XMP APP1 segment. Returns null if not a JPEG.
     */
    readJpegXmp = (buffer) => {
        if (!buffer || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
            return null;
        }
        let
            offset = 2;

        while (offset + 4 <= buffer.length) {
            if (buffer[offset] !== 0xff) {
                break;
            }
            const
                marker = buffer[offset + 1];

            // Standalone markers without length
            if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
                offset += 2;
                continue;
            }
            if (marker === 0x00 || marker === 0xff) {
                offset += 1;
                continue;
            }
            const
                segLen = buffer.readUInt16BE(offset + 2),
                segStart = offset + 4,
                segEnd = offset + 2 + segLen;

            if (segLen < 2 || segEnd > buffer.length) {
                break;
            }
            // SOS — image data follows
            if (marker === 0xda) {
                break;
            }
            if (marker === 0xe1) {
                const
                    ns = JPEG_XMP_NAMESPACE,
                    nsBuf = Buffer.from(ns, 'latin1');

                if (buffer.compare(nsBuf, 0, nsBuf.length, segStart, segStart + nsBuf.length) === 0) {
                    return buffer.slice(segStart + nsBuf.length, segEnd).toString('utf8');
                }
            }
            offset = segEnd;
        }
        return null;
    },
    writeJpegXmp = (buffer, xmpString) => {
        if (!buffer || buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
            throw new Error('Not a JPEG buffer');
        }
        const
            nsBuf = Buffer.from(JPEG_XMP_NAMESPACE, 'latin1'),
            xmpBuf = Buffer.from(xmpString, 'utf8'),
            payload = Buffer.concat([nsBuf, xmpBuf]),
            parts = [buffer.slice(0, 2)]; // SOI

        let
            offset = 2,
            inserted = false,
            insertAfter = 2; // default: right after SOI

        while (offset + 4 <= buffer.length) {
            if (buffer[offset] !== 0xff) {
                break;
            }
            const
                marker = buffer[offset + 1];

            if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
                parts.push(buffer.slice(offset, offset + 2));
                offset += 2;
                insertAfter = parts.length;
                continue;
            }
            if (marker === 0x00 || marker === 0xff) {
                parts.push(buffer.slice(offset, offset + 1));
                offset += 1;
                continue;
            }
            const
                segLen = buffer.readUInt16BE(offset + 2),
                segEnd = offset + 2 + segLen;

            if (segLen < 2 || segEnd > buffer.length) {
                break;
            }
            if (marker === 0xda) {
                // Insert XMP before scan data if not already inserted
                if (!inserted) {
                    const
                        len = payload.length + 2,
                        header = Buffer.alloc(4);

                    header[0] = 0xff;
                    header[1] = 0xe1;
                    header.writeUInt16BE(len, 2);
                    parts.push(header, payload);
                    inserted = true;
                }
                parts.push(buffer.slice(offset));
                return Buffer.concat(parts);
            }

            const
                isXmp = marker === 0xe1 &&
                    buffer.compare(nsBuf, 0, nsBuf.length, offset + 4, offset + 4 + nsBuf.length) === 0;

            if (isXmp) {
                // Drop old XMP; write replacement at this position once
                if (!inserted) {
                    const
                        len = payload.length + 2,
                        header = Buffer.alloc(4);

                    header[0] = 0xff;
                    header[1] = 0xe1;
                    header.writeUInt16BE(len, 2);
                    parts.push(header, payload);
                    inserted = true;
                }
            } else {
                parts.push(buffer.slice(offset, segEnd));
                // Prefer after APP0/JFIF or EXIF APP1
                if (marker === 0xe0 || marker === 0xe1) {
                    insertAfter = parts.length;
                }
            }
            offset = segEnd;
        }

        if (!inserted) {
            const
                len = payload.length + 2,
                header = Buffer.alloc(4),
                head = parts.slice(0, insertAfter),
                tail = parts.slice(insertAfter);

            header[0] = 0xff;
            header[1] = 0xe1;
            header.writeUInt16BE(len, 2);
            return Buffer.concat([...head, header, payload, ...tail, buffer.slice(offset)]);
        }
        return Buffer.concat([...parts, buffer.slice(offset)]);
    };

module.exports = {
    NS,
    parseHashesFromXmp,
    buildXmpPacket,
    injectHashesIntoXmp,
    readJpegXmp,
    writeJpegXmp
};
