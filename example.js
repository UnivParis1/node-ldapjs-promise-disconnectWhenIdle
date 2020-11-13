const ldap = require('./index')

ldap.init({ uri: 'ldap://ldap' })

ldap.search('dc=univ-paris1,dc=fr', '(mail=Pascal.Rigaux@univ-paris1.fr)', [ 'displayName', 'objectClass' ], {}).then(([user]) => {
    console.log(ldap.oneAttr(user.object.displayName))
    console.log(ldap.manyAttrs(user.object.objectClass))
    ldap.destroy()
})