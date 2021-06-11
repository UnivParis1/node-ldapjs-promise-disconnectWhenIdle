const ldapjs = require('ldapjs');


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

let _client, _clientP;
function clientP() {
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
        clientP().then(c => c.search(base, params, (err, res) => {
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

module.exports = { init, destroy, force_new_clientP, search, searchRaw, oneAttr, manyAttrs }
