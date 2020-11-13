const ldap = require('./index')

ldap.init({ uri: 'ldap://ldap' })

ldap.search('dc=univ-paris1,dc=fr', '(mail=Pascal.Rigaux@univ-paris1.fr)', [ 'displayName'], {}).then(l => {
    console.log(l.map(e => e.object.displayName));
    ldap.destroy()
})