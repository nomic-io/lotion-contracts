import { Host } from './host'
let { parse, stringify } = require('deterministic-json')

export function makeBindings(host: Host, address: string) {
  return {
    contract: {
      wrap(targetAddress: string) {
        let target = host.contracts[targetAddress]
        if (target) {
          return protect(target.exports)
        } else {
          throw new Error(
            'Target contract does not exist at address ' + targetAddress
          )
        }
      },
      getBalance() {
        return 0
      },
      getAddress() {
        return address
      }
    }
  }
}

function protect(contractExports: any) {
  return new Proxy(contractExports, {
    get(target, prop) {
      if (typeof target[prop] === 'function') {
        return target[prop]
      } else {
        return parse(stringify(target[prop]))
      }
    },
    set(target, prop, value): any {
      throw new Error('Wrapped contracts are readonly')
    }
  })
}
