/**
 * Just enough of the Web Audio API to test scheduling in jsdom, which has
 * no AudioContext. Records what would have played and when.
 */

type ParamEvent = { type: string; value: number; time: number }

class FakeParam {
  value = 1
  events: ParamEvent[] = []
  setValueAtTime(value: number, time: number) {
    this.events.push({ type: 'set', value, time })
    return this
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'linear', value, time })
    return this
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'exp', value, time })
    return this
  }
  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', value: Number.NaN, time })
    return this
  }
}

class FakeNode {
  connectedTo: FakeNode[] = []
  disconnected = false
  connect<T extends FakeNode>(node: T): T {
    this.connectedTo.push(node)
    return node
  }
  disconnect() {
    this.disconnected = true
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam()
}

export class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine'
  frequency = new FakeParam()
  startAt: number | null = null
  stopAt: number | null = null
  onended: (() => void) | null = null
  start(time: number) {
    this.startAt = time
  }
  stop(time: number) {
    this.stopAt = time
  }
  get freq() {
    return this.frequency.events[0]?.value
  }
}

export class FakeBufferSource extends FakeNode {
  buffer: unknown = null
  started = false
  start() {
    this.started = true
  }
}

export class FakeAudioContext {
  state: AudioContextState = 'suspended'
  currentTime = 0
  sampleRate = 44_100
  destination = new FakeNode()
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  bufferSources: FakeBufferSource[] = []
  resumeCalls = 0
  failResume = false

  resume() {
    this.resumeCalls++
    if (this.failResume) return Promise.reject(new Error('blocked'))
    this.state = 'running'
    return Promise.resolve()
  }
  createOscillator() {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc
  }
  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }
  createBuffer() {
    return {}
  }
  createBufferSource() {
    const source = new FakeBufferSource()
    this.bufferSources.push(source)
    return source
  }

  /** Oscillators that start within [from, to). */
  startedBetween(from: number, to: number) {
    return this.oscillators.filter(
      (o) => o.startAt !== null && o.startAt >= from && o.startAt < to,
    )
  }

  asAudioContext() {
    return this as unknown as AudioContext
  }
}
