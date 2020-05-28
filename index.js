const robots = {
    input: require('./robots/input'),
    state: require('./robots/state'),
    text: require('./robots/text'),
    image: require('./robots/image'),
    video: require('./robots/video')
}

async function start() {
    robots.input()
    await robots.text()
    await robots.image()
    await robots.video();

   //const content = robots.state.load()
   //console.dir(content, { depth: null })
}

start()