const ldapjs = require('ldapjs');
const util = require('util')


let _conf
/**
 * Configure ldap connection
 * @param {Object} conf - ldap connection parameters
 * @param {string | string[]} conf.uri - ldap://xxx
 * @param {string=} conf.dn - dc=foo,ou=bar,dc=univ,dc=fr
 * @param {string=} conf.password - 
 * @param {number=} conf.disconnectWhenIdle_duration - milliseconds
 * @param {boolean=} conf.verbose - 
 */
function init(conf) {
    _conf = conf
}

/** @type {ldapjs.Client} */
let _client
/** @type {Promise<ldapjs.Client>} */
let _clientP;
function get_clientP() {
    if (!_clientP) new_clientP();
    return _clientP;
}

function destroy() {
    if (_client) {
        if (_conf.verbose) console.log("destroying ldap connection");
        _client.destroy();
    }
    _client = undefined;
    _clientP = undefined;
}

function force_new_clientP() {
    new_clientP()
}

function new_clientP() {
    if (!_conf) throw "node-ldapjs-promise-disconnectWhenIdle: call init() first"
    if (_conf.verbose) console.info("connecting to " + _conf.uri);
    const c = ldapjs.createClient({ url: _conf.uri, reconnect: true, idleTimeout: _conf.disconnectWhenIdle_duration });
    c.on('connectError', console.error);
    c.on('error', console.error);
    c.on('idle', destroy);

    _client = c;
    _clientP = new Promise((resolve, reject) => {
        c.on('connect', () => {
            if (_conf.verbose) console.log("connected to ldap server");
            if (_conf.dn) {
                c.bind(_conf.dn, _conf.password, err => {
                    if (err) console.error(err);
                    err ? reject(err) : resolve(c);
                });
            } else {
                resolve(c);
            }
        });
    });
}

/**
 * LDAP search - returning binary values (Buffer) if wanted
 * @param {string} base - LDAP branch to search
 * @param {string} filter - search filter
 * @param {string[]} attributes - attributes to return
 * @param {ldapjs.SearchOptions} options - search options
 * @returns {Promise<ldapjs.SearchEntry[]>} - entries
 */
function searchRaw(base, filter, attributes, options) {
    if (attributes.length === 0) {
        // workaround asking nothing and getting everything. Bug in ldapjs???
        attributes = ['objectClass'];
    }
    if (filter === '(|)') {
        // NB: not handled anymore by ldapjs since ldap-filter 0.3.x
        return Promise.resolve([]);
    }
    try {
        if (filter) filter = ldapjs.parseFilter(filter)
    } catch (err) {
        return Promise.reject("Error parsing LDAP filter: " + err)
    }
    let params = { filter, attributes, scope: "sub", ...options };
    return new Promise((resolve, reject) => {
        let l = [];
        get_clientP().then(c => c.search(base, params, (err, res) => {
            if (err) return reject(err);

            res.on('searchEntry', entry => {
                l.push(entry);
            });
            res.on('searchReference', referral => {
                if (_conf.verbose) console.log('referral: ' + referral.uris.join());
            });
            res.on('error', err => {
                if ((err || {}).name === 'SizeLimitExceededError') {
                    // that's ok, return what we got:
                    resolve(l);
                } else {
                    if (_conf.verbose) console.log("ldap error:" + err);
                    reject(err);
                }
            });
            res.on('end', result => {
                if (result.status === 0)
                    resolve(l);
                else
                    reject("unknown error");
            });
        }));
    });
}

/**
 * LDAP search
 * @param {string} base - LDAP branch to search
 * @param {string} filter - search filter
 * @param {string[]} attributes - attributes to return
 * @param {ldapjs.SearchOptions} options - search options
 * @returns {Promise<ldapjs.SearchEntryObject[]>} - entries
 */
const search = (base, filter, attributes, options) => (
    searchRaw(base, filter, attributes, options).then(l => l.map(e => e.object))
)

async function promisify_method(method) {
    const c = await get_clientP()
    return util.promisify(c[method]).bind(c)
}

/**
 * LDAP add
 * @param {string} dn the DN of the entry to add.
 * @param {Object} entry an array of Attributes to be added or a JS object.
 */
 async function add(dn, entry) {
    if (_conf.verbose) console.log("adding", dn)
    return await (await promisify_method('add'))(dn, entry)
}

/**
 * LDAP delete
 * @param {string} dn the DN of the entry to del.
 */
 async function del(dn, entry) {
    if (_conf.verbose) console.log("del", dn)
    return await (await promisify_method('del'))(dn)
}
/**
 * LDAP modify
 * @param {string} dn the DN of the entry to modify.
 * @param {ldapjs.Change | ldapjs.Change[]} change update to perform (can be [Change]).
 */
 async function modify(dn, change) {
    if (_conf.verbose) console.log("modify", dn)
    return await (await promisify_method('modify'))(dn, change)
}

/**
 * ldapjs return a string if only one value, and an array if multiple values. Enforce first response
 * @param {string|string[]} val 
 * @returns {string}
 */
const oneAttr = (val) => (
    Array.isArray(val) ? val[0] : val
)

/**
 * ldapjs return a string if only one value, and an array if multiple values. Enforce array
 * @param {string|string[]} vals 
 * @returns {string[]}
 */
const manyAttrs = (vals) => (
    Array.isArray(vals) ? vals : vals === undefined ? [] : [vals]
)

module.exports = { init, destroy, force_new_clientP, search, searchRaw, add, del, modify, oneAttr, manyAttrs }
