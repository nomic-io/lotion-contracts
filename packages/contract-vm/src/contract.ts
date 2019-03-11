let loader = require('assemblyscript/lib/loader')
const CONTRACT_CLASS_NAME = 'Contract'
let metering = require('wasm-metering')

type GasMeter = (cost: number) => void

export class Contract {
  public instance: any
  public memory: any
  public contract: any
  public contractInstance: any

  private meteredCode: Buffer
  private consumeGas: GasMeter | undefined

  constructor(public code: Buffer, private bindings = {}) {
    this.contract = new Proxy(
      {},
      {
        get: (target, name, receiver): any => {
          if (typeof this.contractInstance[name] === 'function') {
            return (...args: any[]) => {
              this.initialize()
              return this.contractInstance[name](...args)
            }
          } else if (this.contractInstance[name]) {
            this.initialize()
          }
          return this.contractInstance[name]
        },

        set: (target, name, value): any => {
          this.initialize()
          this.contractInstance[name] = value
        }
      }
    )

    this.meteredCode = metering.meterWASM(this.code)
    Object.assign(this.bindings, {
      metering: {
        usegas: (gas: number) => {
          if (typeof gas === 'number' && gas > 0) {
            if (this.consumeGas) {
              this.consumeGas(gas)
            }
          }
        }
      }
    })
    this.initialize()
  }

  initialize() {
    this.instance = loader.instantiateBuffer(this.meteredCode, this.bindings)

    if (!this.instance[CONTRACT_CLASS_NAME]) {
      throw new Error(
        `Contract must an export a class named ${CONTRACT_CLASS_NAME}`
      )
    }
    /**
     * TODO: Instead of creating a new instance of this class on each initialize(),
     * we should just get a js reference to the instance from a pointer.
     *
     * For now, there's a kind of surprising behavior: constructors are called for every method call,
     * possibly invoking external host functions, but any class state mutations are thrown away because
     * the memory is immediately overwritten with our checkpointed memory.
     */
    this.contractInstance = new this.instance[CONTRACT_CLASS_NAME]()
    if (!this.memory) {
      this.memory = this.instance.memory.buffer
    }
    assignMemory(this.instance.memory.buffer, this.memory)
    this.memory = this.instance.memory.buffer
  }

  useMeter(consumeGas?: GasMeter) {
    this.consumeGas = consumeGas
  }

  loadMemory(memory: any) {
    assignMemory(this.instance.memory.buffer, memory.buffer)
  }
}

function assignMemory(dest: any, src: any) {
  let a = new Uint32Array(src)
  let b = new Uint32Array(dest)
  Object.assign(b, a)
}
