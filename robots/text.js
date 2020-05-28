const algorithmia = require('algorithmia')
const sentenceBoundaryDetection = require('sbd')
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1')
const state = require('./state')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const watsonApiKey = require('../credentials/watson-nlu.json').apikey

const nlu = new NaturalLanguageUnderstandingV1({
    version: '2018-04-05',
    iam_apikey: watsonApiKey,
    url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/',
});

async function robot() {
    const content = state.load()

    await fetchContentFromWikipedia(content)
    sanitizeContent(content)
    breakContentIntoSentences(content)
    limitMaximumSentences(content)
    await fetchKeyworsOfAllSentences(content)

    state.save(content)

    async function fetchContentFromWikipedia(content) {
        const input = {
            "articleName": content.searchTerm,
            "lang": "pt"
        }

        const wikipediaClient = algorithmia.client(algorithmiaApiKey)
        const wikipediaAlgorithmim = wikipediaClient.algo('web/WikipediaParser/0.1.2')
        const wikipediaResponse = await wikipediaAlgorithmim.pipe(input)
        const wikipediaContent = wikipediaResponse.get()

        content.sourceContentOriginal = wikipediaContent.content
    }

    function sanitizeContent(content) {
        const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
        const withousDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)

        content.sourceContentSanitized = withousDatesInParentheses

        function removeBlankLinesAndMarkdown(text) {
            const allLines = text.split('\n')

            const withoutBlankLinesAndMarkdown = allLines.filter((line) => {
                return line.trim().length > 0 && !line.trim().startsWith('=')
            })

            return withoutBlankLinesAndMarkdown.join(' ')
        }

        function removeDatesInParentheses(text) {
            return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g,' ')
        }
    }

    function breakContentIntoSentences(content) {
        content.sentences = []

        const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
        sentences.forEach((sentence) => {
            content.sentences.push({
                text: sentence,
                keywords: [],
                images: []
            })
        })
    }

    function limitMaximumSentences(content) {
        content.sentences = content.sentences.slice(0, content.maximumSentences)
    }

    async function fetchKeyworsOfAllSentences(content) {
        console.log('> [text-robot] Starting to fetch keywords from Watson')

        for(const sentence of content.sentences) {
            console.log(`> [text-robot] Sentence: "${sentence.text}"`)

            sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)

            console.log(`> [text-robot] Keywords: ${sentence.keywords.join(', ')}\n`)
        }
    }

    async function fetchWatsonAndReturnKeywords(sentence) {
        return new Promise((resolve, reject) => {
            nlu.analyze({
                text: sentence,
                features: {
                    keywords: {}
                }
            }, (error, respose) => {
                if(error) {
                    throw error
                }

                const keywords = respose.keywords.map((keyword) => {
                    return keyword.text
                })

                resolve(keywords)
            })
        })
    }
}



module.exports = robot