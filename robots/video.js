const gm = require('gm').subClass({imageMagick: true})
const state = require('./state')
const spawn  = require('child_process').spawn
const path = require('path')
const rootPath = path.resolve(__dirname, '..')
const videoshow = require("videoshow");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
let ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

async function robot() {
    const content = state.load()

    await convertAllImages(content)
    //await createYouTubeThumbnail()
    await createAfterEffectsScript(content)
    await renderVideo("node", content);

    state.save(content)

    async function convertAllImages(content) {
        for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
            await convertImage(sentenceIndex)
        }
    }

    async function convertImage(sentenceIndex) {
        return new Promise((resolve, reject) => {
            const inputFile = `./content/${sentenceIndex}-original.png[0]`
            const outputFile = `./content/${sentenceIndex}-converted.png`
            const width = 1920
            const height = 1080

            console.log(inputFile)

            gm()
            .in(inputFile)
            .out('(')
              .out('-clone')
              .out('0')
              .out('-background', 'white')
              .out('-blur', '0x9')
              .out('-resize', `${width}x${height}^`)
            .out(')')
            .out('(')
              .out('-clone')
              .out('0')
              .out('-background', 'white')
              .out('-resize', `${width}x${height}`)
            .out(')')
            .out('-delete', '0')
            .out('-gravity', 'center')
            .out('-compose', 'over')
            .out('-composite')
            .out('-extent', `${width}x${height}`)
            .write(outputFile, (error) => {
              if (error) {
                return reject(error)
              }
    
              console.log(`> [video-robot] Image converted: ${outputFile}`)
              resolve()
            })
        })
    }

    async function createYouTubeThumbnail() {
        return new Promise((resolve, reject) => {
            gm()
                .in('./content/0-converted.png')
                .write('./content/youtube-thumbnail.jpg', (error) => {
                    if(error) {
                        return reject(error)
                    }

                    console.log('> Creating YouTube Thumbnail')
                    resolve()
                })
        })
    }

    async function createAfterEffectsScript(content) {
        await state.saveScript(content)
    }

    async function renderVideoWithAfterEffects() {
        return new Promise((resolve, reject) => {
            const aerenderFilePath = '/Programas/Adobe/Adobe After Effects CC 2019/Support Files/aerender'
            const templateFilePath = `${rootPath}/templates/1/template.aep`
            const destinationFilePath = `${rootPath}/content/output.mov`

            console.log('> Starting After Effects')

            const aerender = spawn(aerenderFilePath, [
                '-comp', 'main',
                '-project', templateFilePath,
                '-output', destinationFilePath
            ])

            aerender.stdout.on('data', (data) => {
                process.stdout.write(data)
            })

            aerender.on('close', () => {
                console.log('> After Effects closed')
                resolve()
            })
        })
    }

    async function renderVideoWithNode(content) {
        console.log("> starting ffmpeg...");

        let images = [];

        for (
            let sentenceIndex = 0;
            sentenceIndex < content.sentences.length;
            sentenceIndex++
        ) {
            images.push({
                path: `./content/${sentenceIndex}-converted.png`,
                caption: content.sentences[sentenceIndex].text
            });
        }

        const videoOptions = {
            fps: 25,
            loop: 10, // seconds
            transition: true,
            transitionDuration: 2, // seconds
            videoBitrate: 1024,
            videoCodec: "libx264",
            size: "1920x?",
            audioBitrate: "512k",
            audioChannels: 2,
            format: "mp4",
            pixelFormat: "yuv420p",
            useSubRipSubtitles: false, // Use ASS/SSA subtitles instead
            subtitleStyle: {
                Fontname: "Arial",
                Fontsize: "26",
                PrimaryColour: "11861244",
                SecondaryColour: "11861244",
                TertiaryColour: "11861244",
                BackColour: "-2147483640",
                Bold: "2",
                Italic: "0",
                BorderStyle: "2",
                Outline: "2",
                Shadow: "3",
                Alignment: "2", // left, middle, right
                MarginL: "40",
                MarginR: "60",
                MarginV: "40"
            }
        };

        videoshow(images, videoOptions)
        .audio(`${rootPath}\\content\\newsroom.mp3`)
        .save(`${rootPath}\\content\\output.mp4`)
        .on("start", function (command) {
            console.log("ffmpeg process started:", command);
        })
        .on("error", function (err, stdout, stderr) {
            console.error("Error:", err);
            console.error("ffmpeg stderr:", stderr);
        })
        .on("end", function (output) {
            console.error("Video created in:", output);
        });
    }

    async function renderVideo(type, content) {
        if (type == "after") {
            await renderVideoWithAfterEffects();
        } else {
            await renderVideoWithNode(content);
        }
    }
}

module.exports = robot