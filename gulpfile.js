const fs = require('fs');
const gulp = require('gulp');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const argv = require('yargs').argv;
const http = require('http');
const https = require('https');
const filter = require('gulp-filter');
const order = require('gulp-order');
const {
    v4: uuidv4,
} = require('uuid');

const downloadRemoteTo = 'remoteTmp';


if (!fs.existsSync(argv.source)) {
    throw ('Source dir (' + argv.source + ') seems to not exit...');
}

let helper = {
    _getWebTransportObj: function (fileName) {
        let webTransportObj;
        if (fileName.match(/^https/i)) {
            webTransportObj = https;
        } else if (fileName.match(/^http/i)) {
            webTransportObj = http;
        }
        return webTransportObj;
    },
    httpGetPromise: url => {
        return new Promise((resolve, reject) => {
            helper._getWebTransportObj(url).get(url, response => {
                resolve(response);
            })
        });
    },
    getScriptPromise: (url, localPath) => {
        return new Promise((resolve, reject) => {
            helper.httpGetPromise(url).then(response => {
                let localFile = fs.createWriteStream(localPath);
                response.pipe(localFile).on('close', () => {
                    resolve({url, localPath})
                });
            })
        });
    },
    getConfig: (sourceDir) => {
        let configJSONString;
        let configPath = sourceDir + '/gulpConfig.json';

        if (fs.existsSync(configPath)) {
            configJSONString = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configJSONString);
        } else {
            console.warn('There is no config (' + configPath + ') file for this operation');
            return;
        }
    },
    downloadRemoteFiles: (arrayOfFiles, downloadToDir) => {
        return new Promise((resolve) => {
            if (!fs.existsSync(downloadToDir)) {
                fs.mkdirSync(downloadToDir);
            }
            let promises = [];
            for (let index in arrayOfFiles) {
                let fileName = arrayOfFiles[index];
                let newFileName = uuidv4() + '.js';
                if (helper._getWebTransportObj(fileName)) {
                    promises.push(helper.getScriptPromise(fileName, downloadToDir + '/' + newFileName).then(() => {
                        arrayOfFiles[index] = {name: newFileName, remote: true};
                    }));
                }
            }
            Promise.all(promises).then(() => {
                resolve(arrayOfFiles);
            });
        })
    },
    concat: async (stream, config, sourceDir, downloadRemoteTo) => {
        if (!config.concat) {
            return stream;
        }

        for (let concatInFile in config.concat) {
            let concatOrder = config.concat[concatInFile];
            concatOrder = await helper.downloadRemoteFiles(concatOrder, downloadRemoteTo);

            let filterThese = [], processedConcatOrder = [];
            let dir;
            for (let fileName of concatOrder) {
                if ('String' != typeof fileName && fileName.remote) {
                    processedConcatOrder.push(fileName.name);
                    filterThese.push(downloadRemoteTo + '/' + fileName.name);
                    stream = stream.pipe(gulp.src(downloadRemoteTo + '/' + fileName.name));
                } else {
                    processedConcatOrder.push(fileName);
                    filterThese.push(sourceDir + '/' + fileName)
                }
            }
            let f = filter(filterThese, {restore: true});
            stream = stream.pipe(f)
                .pipe(order(processedConcatOrder))
                .pipe(concat(concatInFile))
                .pipe(f.restore);
        }
        return stream;
    }
}

async function minifyAndConcatJS() {
    let config = helper.getConfig(argv.source);
    let stream = gulp.src(argv.source + '/**/*.js')
        .pipe(uglify());

    return (await helper.concat(stream, config, argv.source, downloadRemoteTo))
        .pipe(gulp.dest(argv.destination));
}

async function clearDownloadedTmpDir() {
   await fs.rm(downloadRemoteTo, {recursive: true, force: true}, function () {});
}


exports.default = gulp.series(minifyAndConcatJS, clearDownloadedTmpDir);