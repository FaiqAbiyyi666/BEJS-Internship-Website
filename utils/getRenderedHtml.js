const ejs = require('ejs');
const fs = require('fs');
const VIEWS_PATH = `${__dirname}/../views`;

module.exports = (template, data) => {
  const templateFile = fs.readFileSync(
    `${VIEWS_PATH}/${template}.ejs`,
    'utf-8'
  );

  const renderedHtml = ejs.render(templateFile, data);
  return renderedHtml;
};
