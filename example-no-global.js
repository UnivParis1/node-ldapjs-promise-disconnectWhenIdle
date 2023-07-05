const ldap = require('./index')

const conf = { uri: ['ldap://ldap', 'ldap://ldap2'] }
const client = ldap.new_client(conf)
const clientP = ldap.may_bind(conf, client)

ldap.search('dc=univ-paris1,dc=fr', '(mail=Pascal.Rigaux@univ-paris1.fr)', [ 'displayName', 'objectClass' ], {}, clientP).then(([user]) => {
    console.log(ldap.oneAttr(user.displayName))
    console.log(ldap.manyAttrs(user.objectClass))
    client.destroy()
})