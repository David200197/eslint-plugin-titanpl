export function isTitanCallee(calleePath) {
    if (!calleePath || typeof calleePath !== 'string') {
        return false;
    }
    return calleePath.startsWith('t.') || calleePath.startsWith('Titan.');
}