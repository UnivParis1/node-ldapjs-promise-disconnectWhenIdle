const ldap = require('./index')

ldap.init({ uri: ['ldap://ldap', 'ldap://ldap2'] })

ldap.search('dc=univ-paris1,dc=fr', '(mail=Pascal.Rigaux@univ-paris1.fr)', [ 'displayName', 'objectClass' ], {}).then(([user]) => {
    console.log(ldap.oneAttr(user.displayName))
    console.log(ldap.manyAttrs(user.objectClass))
    ldap.destroy()
})