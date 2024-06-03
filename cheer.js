#!/usr/bin/env node

const
    cheer = require('./src/index'),
    getArgsAsObj = () => {
        const
            {argv: args} = process,
            cmds = {},
            cleanKey = (key) => key.replace(/\-/g, ' ').trim().replace(/ /g, '-');
        let key = '';
        
        // copy arguments into environment data.
        for (let i = 2; i < args.length; i++) {
            const
                arg = args[i];

            if (arg[0] === '-') {
                if (key) {
                    cmds[key] = true;
                }
                key = cleanKey(arg);
            } else if (key) {
                cmds[key] = arg;
                key = '';
            } else {
                cmds[cleanKey(arg)] = true;
            }
        }

        if (key) { // in case last option has no value
            cmds[key] = true;
        }

        return cmds;
    };

cheer(getArgsAsObj());