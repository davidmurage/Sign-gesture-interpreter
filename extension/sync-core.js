'use strict';
const fs=require('node:fs'),path=require('node:path');
fs.copyFileSync(path.resolve(__dirname,'..','meeting-overlay','core.js'),path.resolve(__dirname,'core.js'));
console.log('Synchronized extension/core.js from meeting-overlay/core.js');
