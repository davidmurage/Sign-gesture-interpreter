const test=require('node:test'),assert=require('node:assert/strict');
const {isInMeeting}=require('../public/context');
test('only exact inMeeting context is supported',()=>{assert.equal(isInMeeting('inMeeting'),true);assert.equal(isInMeeting({context:'inMeeting'}),true);assert.equal(isInMeeting('inMainClient'),false);assert.equal(isInMeeting(undefined),false);});
