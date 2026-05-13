export class SmartTokenMissingError extends Error {
  constructor() {
    super('SMART token missing — relaunch required')
    this.name = 'SmartTokenMissingError'
  }
}
