const
    JSONFile = require("../formats/JSONFile"),
    LRC = require("../formats/LRC"),
    MP3 = require("../formats/MP3"),
    SAMI = require("../formats/SAMI"),
    SRT = require("../formats/SRT"),
    VTT = require("../formats/VTT"),
    formats = {
        json: JSONFile,
        lrc: LRC,
        mp3: MP3,
        sami: SAMI,
        smi: SAMI,
        srt: SRT,
        vtt: VTT
    };

module.exports = async (path, fileType) => {
    const
        lcFormat = fileType.toLowerCase(),
        File = formats[lcFormat] ?? formats.JSONFile;

    // Find file type and throw if that doesn't work.
    if (File) {
        const
            file = new File({fileType: lcFormat});

        await file.load(path);
        return file;
    } else {
        throw `"${fileType}" not supported.`;
    }
};