const
    fs = require('fs').promises,
    File = require("./File"),
    removeComments = (html) => html.replace(/<!--[\s\S]*?-->/g, ''),
    cleanHTML = (html) => html
        .replace(/<[^>]+>/g, '')   // remove HTML tags
        .replace(/&nbsp;/gi, ' ')  // decode common HTML entities
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .trim();

module.exports = class SAMI extends File {
    async load (path) {
        await super.load(path);
        this.data = await fs.readFile(path, 'utf8');
        return this.data;
    }

    getHash () {
        const
            match = this.data.match(/<META[\s]+Hash="([a-f0-9]+)"/i);

        return match ? match[1] : null;
    }

    toString () {
        const
            sami = removeComments(this.data),
            regex = /<P[^>]*>([\s\S]*?)<\/P>/gi,
            matches = [];
        let match;

        while ((match = regex.exec(sami)) !== null) {
            const
                innerText = cleanHTML(match[1]);
                
            if (innerText) {
                matches.push(innerText);
            }
        }
                
        return matches.join(' ');
    }
}