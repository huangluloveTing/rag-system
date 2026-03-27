setTimeout(() => {
    console.log('timer 1')
}, 0);

new Promise(r => {
    r('promise 1')
}).then(console.log)

process.nextTick(() => {
    console.log('next ticket 1')
})

