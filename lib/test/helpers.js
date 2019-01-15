const enumaTap = require('@enumatech/tap')
const {t} = enumaTap

if (module === require.main) {
    t.pass('ok')
    return
}
