const Path = require('path')
const Jayson = require('../jayson.js')

describe('Jayson', () => {
    describe('.parse', () => {
        describe('valid JSON', () => {
            it('works', async () => {
                expect(Jayson.parse('No error', '{"valid": "json"}'))
                    .toMatchObject({valid: "json"})
            })
        })

        describe('null', () => {
            it('fails', async () => {
                expect(()=>Jayson.parse('Expected error', null))
                    .toThrowError(/Expected error.+"null"/)
            })
        })

        describe('empty string', () => {
            it('fails', async () => {
                expect(()=>Jayson.parse('Expected error', ''))
                    .toThrowError(/Expected error.+empty string/)
            })
        })

        describe('invalid JSON', () => {
            it('fails', async () => {
                expect(()=>Jayson.parse('Expected error', 'invalid json'))
                    .toThrowError(/Expected error.+\ninvalid json/)
            })
        })
    })

    describe('.load', () => {
        describe('file with valid JSON content', () => {
            it('returns the content', async () => {
                expect(Jayson.load(Path.join(__dirname, 'valid.json')))
                    .toMatchObject({
                        valid: 1,
                        json: null,
                        data: true
                    })
            })
        })
        describe('file with invalid JSON content', () => {
            it('fails', async () => {
                const filename = 'invalid.json'
                const content = 'invalid json content'
                expect(() => Jayson.load(Path.join(__dirname, filename)))
                    .toThrowError(new RegExp(`${filename}.+\n${content}`))
            })
        })
    })
})
