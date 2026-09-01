/**
 * Client-side mirror of Cheerfully server/helpers/jobExports.js
 * Keep catalog subsets in sync with the canonical Cheerfully module.
 */

const LYRIC_FORMATS = ['json', 'lrc', 'mp3', 'sami', 'smi', 'srt', 'vtt', 'tsv', 'xml', 'dat'];
const TRANSCRIPTION_FORMATS = ['json', 'lrc', 'mp3', 'sami', 'smi', 'srt', 'vtt'];
const PACKFULLY_FORMATS = ['texturepacker', 'json-array', 'createjs', 'spine', 'css', 'starling', 'unity', 'godot'];
const TRANSLATE_FORMATS = ['json', 'i18n', 'po', 'xliff', 'properties', 'yml', 'yaml', 'strings', 'xml', 'csv', 'tsv'];

const EXPORT_CATALOG = {
    transcription: {
        keys: ['format', 'exportFormat', 'exports', 'f'],
        formats: TRANSCRIPTION_FORMATS,
        constraints: {mp3: {sourceExt: 'mp3'}}
    },
    rhubarb: {
        keys: ['exportFormat', 'exports', 'f'],
        formats: LYRIC_FORMATS,
        constraints: {mp3: {sourceExt: 'mp3'}}
    },
    allosaurus: {
        keys: ['exportFormat', 'exports', 'f'],
        formats: LYRIC_FORMATS,
        constraints: {mp3: {sourceExt: 'mp3'}}
    },
    translate: {
        keys: ['format', 'exports'],
        formats: TRANSLATE_FORMATS
    },
    packfully: {
        keys: ['format', 'exports', 'exportFormat'],
        formats: PACKFULLY_FORMATS
    }
};

const normalizeFormatId = (format) => {
    const
        id = String(format).toLowerCase().replace(/^\./, '');

    if (id === 'jpeg') {
        return 'jpg';
    }

    return id;
};

const extractRawValue = (job = {}, keys = []) => {
    for (let i = 0; i < keys.length; i++) {
        const
            key = keys[i];

        if (job[key] !== undefined) {
            return job[key];
        }

        if (job.options?.[key] !== undefined) {
            return job.options[key];
        }
    }

    return undefined;
};

const applyConstraints = (formats, constraints = {}, {sourceExt} = {}) => formats.filter((format) => {
    const
        rule = constraints[format];

    if (!rule) {
        return true;
    }

    if (rule.sourceExt && sourceExt && rule.sourceExt !== sourceExt) {
        return false;
    }

    return true;
});

const resolveJobExports = (job = {}, serviceId, {sourceExt, defaultFormats} = {}) => {
    const
        catalog = EXPORT_CATALOG[serviceId];

    if (!catalog) {
        throw new Error(`Unknown export service "${serviceId}"`);
    }

    const
        raw = extractRawValue(job, catalog.keys);

    if (raw === undefined) {
        const
            fallback = defaultFormats?.length
                ? defaultFormats.map(normalizeFormatId)
                : [catalog.formats[0]];

        return applyConstraints([...new Set(fallback)], catalog.constraints, {sourceExt});
    }

    if (raw === null || raw === '') {
        return applyConstraints([...catalog.formats], catalog.constraints, {sourceExt});
    }

    const
        list = (Array.isArray(raw) ? raw : [raw])
            .map(normalizeFormatId)
            .filter(Boolean),
        seen = new Set(),
        out = [];

    list.forEach((format) => {
        if (!catalog.formats.includes(format)) {
            return;
        }

        if (!seen.has(format)) {
            seen.add(format);
            out.push(format);
        }
    });

    const
        constrained = applyConstraints(out.length ? out : [catalog.formats[0]], catalog.constraints, {sourceExt});

    return constrained.length ? constrained : applyConstraints([catalog.formats[0]], catalog.constraints, {sourceExt});
};

module.exports = {
    EXPORT_CATALOG,
    resolveJobExports
};
