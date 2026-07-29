/**
 * Image hash embedders — run with: npm test / node --test test/imageHash.test.js
 */
const
    assert = require('assert'),
    fs = require('fs').promises,
    path = require('path'),
    sharp = require('sharp'),
    getImageFile = require('../src/helpers/getImageFile'),
    {
        HASH_KEYS,
        hashPayload,
        checkImageOutputs,
        writeImageHashes,
        predictSharpOutputs
    } = require('../src/helpers/imageHash'),
    TMP = path.join(__dirname, '.tmp-imagehash');

(async () => {
    await fs.rm(TMP, {recursive: true, force: true});
    await fs.mkdir(TMP, {recursive: true});

    const
        make = async (name, {format = 'png'} = {}) => {
            const
                file = path.join(TMP, name),
                pipeline = sharp({
                    create: {
                        width: 12,
                        height: 12,
                        channels: 3,
                        background: {r: 12, g: 34, b: 56}
                    }
                });

            if (format === 'jpg' || format === 'jpeg') {
                await pipeline.jpeg().toFile(file);
            } else if (format === 'webp') {
                await pipeline.webp().toFile(file);
            } else {
                await pipeline.png().toFile(file);
            }
            return file;
        };

    // --- stable canonical hash ---
    {
        assert.strictEqual(
            hashPayload({b: 2, a: [1, {z: 9, y: 8}]}),
            hashPayload({a: [1, {y: 8, z: 9}], b: 2})
        );
        assert.notStrictEqual(
            hashPayload({options: {quality: 80}}),
            hashPayload({options: {quality: 90}})
        );
    }

    // --- PNG multi-key ---
    {
        const
            file = await make('multi.png'),
            img = await getImageFile(file);

        img.addHash('sharp-1', {hashKey: HASH_KEYS.sharp});
        img.addHash('pack-1', {hashKey: HASH_KEYS.packfully});
        await img.save();

        const
            again = await getImageFile(file);

        assert.strictEqual(again.getHash({hashKey: HASH_KEYS.sharp}), 'sharp-1');
        assert.strictEqual(again.getHash({hashKey: HASH_KEYS.packfully}), 'pack-1');
        assert.strictEqual(again.getHash({hashKey: HASH_KEYS.stackfully}), null);
    }

    // --- JPEG multi-key ---
    {
        const
            file = await make('multi.jpg', {format: 'jpg'}),
            img = await getImageFile(file);

        img.addHash('s', {hashKey: HASH_KEYS.sharp});
        img.addHash('t', {hashKey: HASH_KEYS.stackfully});
        await img.save();

        const
            again = await getImageFile(file);

        assert.strictEqual(again.getHash({hashKey: HASH_KEYS.sharp}), 's');
        assert.strictEqual(again.getHash({hashKey: HASH_KEYS.stackfully}), 't');
        assert.strictEqual(again.getHash({hashKey: HASH_KEYS.packfully}), null);
    }

    // --- WebP multi-key ---
    {
        const
            file = await make('multi.webp', {format: 'webp'}),
            img = await getImageFile(file);

        img.addHash('w1', {hashKey: HASH_KEYS.sharp});
        img.addHash('w2', {hashKey: HASH_KEYS.packfully});
        await img.save();

        const
            again = await getImageFile(file);

        assert.strictEqual(again.getHash({hashKey: HASH_KEYS.sharp}), 'w1');
        assert.strictEqual(again.getHash({hashKey: HASH_KEYS.packfully}), 'w2');
    }

    // --- unsupported ICO ---
    {
        const
            ico = await getImageFile(path.join(TMP, 'x.ico'), 'ico');

        assert.strictEqual(ico.supportsHash, false);
        assert.strictEqual(ico.getHash({hashKey: HASH_KEYS.sharp}), null);
        ico.addHash('nope', {hashKey: HASH_KEYS.sharp});
        assert.strictEqual(ico.getHash({hashKey: HASH_KEYS.sharp}), null);
    }

    // --- checkImageOutputs + writeImageHashes ---
    {
        const
            png = await make('out.png'),
            name = 'out.png';

        await writeImageHashes({
            outputDir: TMP,
            files: [name],
            inputHash: 'abc123',
            hashKey: HASH_KEYS.sharp
        });

        const
            match = await checkImageOutputs({
                outputDir: TMP,
                expectedOutputs: [name],
                inputHash: 'abc123',
                hashKey: HASH_KEYS.sharp
            }),
            mismatch = await checkImageOutputs({
                outputDir: TMP,
                expectedOutputs: [name],
                inputHash: 'other',
                hashKey: HASH_KEYS.sharp
            }),
            otherKey = await checkImageOutputs({
                outputDir: TMP,
                expectedOutputs: [name],
                inputHash: 'abc123',
                hashKey: HASH_KEYS.packfully
            }),
            unsupported = await checkImageOutputs({
                outputDir: TMP,
                expectedOutputs: ['icon.ico'],
                inputHash: 'x',
                hashKey: HASH_KEYS.sharp
            });

        assert.deepStrictEqual(match.present, [name]);
        assert.deepStrictEqual(match.missing, []);
        assert.deepStrictEqual(mismatch.missing, [name]);
        assert.deepStrictEqual(otherKey.missing, [name]);
        assert.ok(unsupported.unsupported.includes('icon.ico'));
        assert.ok(unsupported.missing.includes('icon.ico'));
        assert.ok(png);
    }

    // --- predictSharpOutputs ---
    {
        assert.deepStrictEqual(
            predictSharpOutputs('hero.png', {format: 'webp'}),
            ['hero.webp']
        );
        assert.deepStrictEqual(
            predictSharpOutputs('logo.png', {
                format: ['ico', 'png'],
                sizes: [16, 32],
                prefix: 'favicon'
            }).sort(),
            ['favicon-16.png', 'favicon-32.png', 'favicon.ico'].sort()
        );
    }

    await fs.rm(TMP, {recursive: true, force: true});
    console.log('imageHash tests passed');
})().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
