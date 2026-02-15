var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
import { readFile as readFile2 } from "fs/promises";
import path5 from "path";
import yargs from "yargs";
import { Marked } from "marked";

// service.js
import { load } from "cheerio";
import path from "path";
import { readFile, writeFile, access, constants } from "fs/promises";
async function checkFileExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
__name(checkFileExists, "checkFileExists");
function removeAsterisksIfExactlyFour(inputString) {
  const asteriskCount = (inputString.match(/\*/g) || []).length;
  if (asteriskCount === 4) {
    return inputString.replace(/\*/g, "");
  }
  return inputString;
}
__name(removeAsterisksIfExactlyFour, "removeAsterisksIfExactlyFour");
function removeSurroundingPunctuation(str) {
  str = str.trim();
  const punctuation = `'"\`()[]{}<>.,;:!?~\xB7\u2014\u2026\u201C\u201D\u2018\u2019`;
  if (typeof str !== "string" || str.length < 2) {
    return str;
  }
  const firstChar = str[0];
  const lastChar = str[str.length - 1];
  if (firstChar === lastChar && punctuation.includes(firstChar)) {
    return str.slice(1, -1);
  }
  if (str.length >= 4 && str.startsWith("*") && str.endsWith("*")) {
    return str.slice(1, -1);
  }
  const result = removeAsterisksIfExactlyFour(str);
  return result;
}
__name(removeSurroundingPunctuation, "removeSurroundingPunctuation");
function removeWhitespaceBetweenTags(htmlString) {
  if (!htmlString || typeof htmlString !== "string") {
    return "";
  }
  const cleanedString = htmlString.replace(/>\s+</g, "><").trim();
  return cleanedString;
}
__name(removeWhitespaceBetweenTags, "removeWhitespaceBetweenTags");
function fixListItemsWithExtraText(markdownText) {
  const lines = markdownText.split("\n");
  const fixedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*[-*+]\s+/.test(line)) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") {
        j++;
      }
      if (j < lines.length && !/^\s*[-*+]\s+/.test(lines[j]) && !/^\s*\d+\.\s+/.test(lines[j]) && lines[j].trim() !== "") {
        fixedLines.push(line);
        if (i + 1 < lines.length && lines[i + 1].trim() === "") {
        } else {
          fixedLines.push("");
        }
        continue;
      }
    }
    fixedLines.push(line);
  }
  const result = fixedLines.join("\n");
  return result;
}
__name(fixListItemsWithExtraText, "fixListItemsWithExtraText");
function trimOuterPTags(html) {
  html = html.replace(/^<p[^>]*>/i, "");
  html = html.replace(/<\/p[^>]*>$/i, "");
  return html;
}
__name(trimOuterPTags, "trimOuterPTags");
async function getAccessToken(CONFIG) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.APP_ID}&secret=${CONFIG.APP_SECRET}`;
  const response = await fetch(url, {
    headers: { Connection: "close" }
  });
  if (!response.ok) {
    await response.text();
    throw new Error(`API \u8BF7\u6C42\u5931\u8D25\uFF0C\u72B6\u6001\u7801: ${response.status}`);
  }
  const data = await response.json();
  if (data.access_token) {
    const tokenInfo = {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      fetchTime: Date.now()
    };
    await writeFile(CONFIG.TOKEN_FILE_PATH, JSON.stringify(tokenInfo, null, 2), "utf8");
    return data.access_token;
  } else {
    throw new Error(`\u83B7\u53D6 Access Token \u5931\u8D25: ${JSON.stringify(data)}`);
  }
}
__name(getAccessToken, "getAccessToken");
async function checkAndRefreshToken(CONFIG) {
  try {
    await access(CONFIG.TOKEN_FILE_PATH);
    const tokenData = await readFile(CONFIG.TOKEN_FILE_PATH, "utf8");
    const { accessToken, expiresIn, fetchTime } = JSON.parse(tokenData);
    if (Date.now() - fetchTime < (expiresIn - 600) * 1e3) {
      return accessToken;
    } else {
      return await getAccessToken(CONFIG);
    }
  } catch (error) {
    return await getAccessToken(CONFIG);
  }
}
__name(checkAndRefreshToken, "checkAndRefreshToken");
async function uploadFile(url, filePath) {
  await access(filePath);
  const fileBuffer = await readFile(filePath);
  const fileBlob = new Blob([fileBuffer]);
  const formData = new FormData();
  formData.append("media", fileBlob, path.basename(filePath));
  const response = await fetch(url, {
    method: "POST",
    headers: { Connection: "close" },
    // 禁用 keep-alive
    body: formData
  });
  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`\u6587\u4EF6\u4E0A\u4F20 API \u8BF7\u6C42\u5931\u8D25: ${JSON.stringify(errorBody)}`);
  }
  return await response.json();
}
__name(uploadFile, "uploadFile");
async function uploadContentImage(imagePath, accessToken, CONFIG) {
  const url = `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${accessToken}`;
  try {
    const data = await uploadFile(url, imagePath);
    if (data && data.url) {
      return data.url;
    } else {
      throw new Error(`\u4E0A\u4F20\u6B63\u6587\u56FE\u7247\u540E\u672A\u6536\u5230\u6709\u6548 URL: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("invalid credential") || error.message.includes("access_token is invalid"))) {
      const newAccessToken = await getAccessToken(CONFIG);
      const retryUrl = `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${newAccessToken}`;
      const retryData = await uploadFile(retryUrl, imagePath);
      if (retryData && retryData.url) {
        return retryData.url;
      } else {
        throw new Error(`\u91CD\u8BD5\u4E0A\u4F20\u6B63\u6587\u56FE\u7247\u540E\u4ECD\u672A\u6536\u5230\u6709\u6548 URL: ${JSON.stringify(retryData)}`);
      }
    } else {
      throw error;
    }
  }
}
__name(uploadContentImage, "uploadContentImage");
async function uploadCoverImage(imagePath, accessToken, CONFIG) {
  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`;
  try {
    const data = await uploadFile(url, imagePath);
    if (data && data.media_id) {
      return data.media_id;
    } else {
      throw new Error(`\u4E0A\u4F20\u5C01\u9762\u56FE\u540E\u672A\u6536\u5230\u6709\u6548 media_id: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("invalid credential") || error.message.includes("access_token is invalid") || error.message.includes("40001"))) {
      const newAccessToken = await getAccessToken(CONFIG);
      const retryUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${newAccessToken}&type=image`;
      const retryData = await uploadFile(retryUrl, imagePath);
      if (retryData && retryData.media_id) {
        return retryData.media_id;
      } else {
        throw new Error(`\u91CD\u8BD5\u540E\u4E0A\u4F20\u5C01\u9762\u56FE\u4ECD\u672A\u6536\u5230\u6709\u6548 media_id: ${JSON.stringify(retryData)}`);
      }
    }
    throw error;
  }
}
__name(uploadCoverImage, "uploadCoverImage");

// theme.js
import fs from "fs";
import path2 from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var cachedThemes = {};
var currentThemeName = "blue";
var blueTheme = {
  name: "\u84DD\u8272\u4E3B\u9898",
  description: "\u9ED8\u8BA4\u84DD\u8272\u4E3B\u9898\uFF0C\u4E13\u4E1A\u7B80\u7EA6\u98CE\u683C",
  decorations: {
    h2Prefix: "",
    h2Suffix: "",
    h3Prefix: "",
    h3Suffix: "",
    listSymbol: "\u25B8",
    hrSymbol: "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550"
  },
  base: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
    sizes: {
      content: "15px",
      code: "13px"
    },
    spacing: {
      h2Bottom: "16px",
      h3Bottom: "14px",
      contentBottom: "0px"
    },
    defaultTextColor: "#3D4852"
  },
  colors: {
    primary: "#3B82F6",
    secondary: "#3B82F6",
    accent: "#2563EB",
    text: "#3D4852",
    markBg: "#EFF6FF",
    markText: "#1D4ED8",
    codeBg: "#F1F5F9",
    codeText: "#1E40AF",
    quoteBg: "#F8FAFC",
    quoteText: "#475569",
    listColor: "#3B82F6"
  },
  codeBlock: {
    outerBg: "#FFFFFF",
    border: "#E2E8F0",
    headerBg: "#3B82F6",
    headerText: "#FFFFFF",
    contentBg: "#1E293B",
    contentText: "#E2E8F0",
    dots: {
      red: "#FF5F56",
      yellow: "#FFBD2E",
      green: "#27C93F"
    }
  },
  blockquoteAlert: {
    note: {
      barColor: "#3B82F6",
      bgColor: "#EFF6FF"
    },
    tip: {
      barColor: "#10B981",
      bgColor: "#ECFDF5"
    },
    important: {
      barColor: "#8B5CF6",
      bgColor: "#F5F3FF"
    },
    warning: {
      barColor: "#F59E0B",
      bgColor: "#FFFBEB"
    },
    caution: {
      barColor: "#EF4444",
      bgColor: "#FEF2F2"
    }
  },
  blockquoteNormal: {
    barColor: "#3B82F6",
    bgColor: "#F8FAFC"
  },
  hr: {
    borderColor: "#E2E8F0"
  },
  headingSpan: {
    backgroundColor: "#EFF6FF",
    color: "#1D4ED8"
  },
  settings: {
    h2: { size: "18px" },
    h3: { size: "17px" },
    lineHeight: "1.75",
    borderWidth: "3px",
    borderPadding: "8px",
    codePadding: "2px 6px",
    codeRadius: "4px",
    quotePadding: "12px 16px",
    listPadding: "20px",
    codeBlockRadius: "8px",
    codeBlockHeaderPadding: "8px 12px",
    codeBlockLineHeight: "1.6"
  }
};
function getThemesDir() {
  return path2.join(__dirname, "themes");
}
__name(getThemesDir, "getThemesDir");
function loadTheme(themeName = "blue") {
  if (cachedThemes[themeName]) {
    return cachedThemes[themeName];
  }
  if (themeName === "blue") return blueTheme;
  const themesDir = getThemesDir();
  const themePath = path2.join(themesDir, `${themeName}.json`);
  if (!fs.existsSync(themePath)) {
    console.error(`\u4E3B\u9898 "${themeName}" \u4E0D\u5B58\u5728\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u4E3B\u9898 "blue"`);
    return loadTheme("blue");
  }
  const themeContent = fs.readFileSync(themePath, "utf-8");
  cachedThemes[themeName] = JSON.parse(themeContent);
  return cachedThemes[themeName];
}
__name(loadTheme, "loadTheme");
function setCurrentTheme(themeName = "blue") {
  const theme = loadTheme(themeName);
  currentThemeName = themeName;
  for (const key in BASE_CONFIG) {
    delete BASE_CONFIG[key];
  }
  Object.assign(BASE_CONFIG, theme.base);
  const newThemeColors = {
    ...theme.colors,
    codeBlock: theme.codeBlock,
    blockquoteAlert: theme.blockquoteAlert,
    blockquoteNormal: theme.blockquoteNormal,
    hr: theme.hr,
    headingSpan: theme.headingSpan,
    decorations: theme.decorations || null
  };
  for (const key in BLUE_THEME) {
    delete BLUE_THEME[key];
  }
  Object.assign(BLUE_THEME, newThemeColors);
  for (const key in BLUE_THEME_SETTINGS) {
    delete BLUE_THEME_SETTINGS[key];
  }
  Object.assign(BLUE_THEME_SETTINGS, theme.settings);
  return theme;
}
__name(setCurrentTheme, "setCurrentTheme");
var defaultTheme = loadTheme("blue");
var BASE_CONFIG = { ...defaultTheme.base };
var BLUE_THEME = {
  ...defaultTheme.colors,
  codeBlock: defaultTheme.codeBlock,
  blockquoteAlert: defaultTheme.blockquoteAlert,
  blockquoteNormal: defaultTheme.blockquoteNormal,
  hr: defaultTheme.hr,
  headingSpan: defaultTheme.headingSpan
};
var BLUE_THEME_SETTINGS = { ...defaultTheme.settings };

// renderer.js
function getEmRenderer(theme) {
  return {
    renderer: {
      em({ tokens }) {
        const content = this.parser.parseInline(tokens);
        const result = `<span style="font-style: italic;">${content}</span>`;
        return result;
      }
    }
  };
}
__name(getEmRenderer, "getEmRenderer");
function getStrongRenderer(theme) {
  return {
    renderer: {
      strong({ tokens }) {
        const content = this.parser.parseInline(tokens);
        const accentColor = BLUE_THEME.accent;
        const result = `<strong style="color: ${accentColor}; font-weight: 700;">${content}</strong>`;
        return result;
      }
    }
  };
}
__name(getStrongRenderer, "getStrongRenderer");
function getHeadingRenderer(theme) {
  return {
    renderer: {
      heading(token) {
        const text = token.text.trim();
        const level = token.depth;
        const cleanText = removeSurroundingPunctuation(text);
        const effectiveLevel = [
          1,
          2
        ].includes(level) ? 2 : 3;
        let fontSize, textColor;
        const decorations = BLUE_THEME.decorations;
        let prefix = "";
        let suffix = "";
        if (decorations) {
          if (effectiveLevel === 2) {
            prefix = decorations.h2Prefix || "";
            suffix = decorations.h2Suffix || "";
          } else {
            prefix = decorations.h3Prefix || "";
            suffix = decorations.h3Suffix || "";
          }
        }
        switch (effectiveLevel) {
          case 2:
            fontSize = BLUE_THEME_SETTINGS.h2.size;
            textColor = BLUE_THEME.primary;
            break;
          case 3:
            fontSize = BLUE_THEME_SETTINGS.h3.size;
            textColor = BLUE_THEME.secondary;
            break;
        }
        const headingStyle = `
          display: block;
          margin: 20px 0 16px 0;
          font-family: ${BASE_CONFIG.fontFamily};
          font-size: ${fontSize};
          font-weight: 700;
          color: ${textColor};
          text-align: center;
          line-height: 1.4;
        `.trim();
        const lineStyle = `
          display: block;
          width: 60px;
          height: 3px;
          background-color: ${textColor};
          margin: 8px auto 0 auto;
          border-radius: 2px;
        `.trim();
        const displayText = `${prefix}${cleanText}${suffix}`;
        const result = `<h${effectiveLevel} style="${headingStyle}">${displayText}<span style="${lineStyle}"></span></h${effectiveLevel}>`.trim();
        return removeWhitespaceBetweenTags(result);
      }
    }
  };
}
__name(getHeadingRenderer, "getHeadingRenderer");
function getListitemRenderer(themeColors) {
  const decorations = BLUE_THEME.decorations;
  const listBullet = decorations?.listSymbol || "\u2022";
  const listColor = BLUE_THEME.listColor;
  const checkboxBaseStyle = `
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    margin-right: 8px;
    vertical-align: middle;
    text-align: center;
    line-height: 16px;
    font-size: 12px;
  `.trim().replace(/\s+/g, " ");
  const uncheckedStyle = `${checkboxBaseStyle} border: 2px solid ${BLUE_THEME.primary}; background-color: #fff;`;
  const checkedStyle = `${checkboxBaseStyle} border: 2px solid ${BLUE_THEME.primary}; background-color: ${BLUE_THEME.primary}; color: #fff;`;
  return {
    renderer: {
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.ListItem 对象
       * @param {boolean} isOrdered - 是否是有序列表项（由 list 渲染器传入）
       */
      listitem: /* @__PURE__ */ __name(function(token, isOrdered = false) {
        const content = this.parser.parse(token.tokens);
        const cleanContent = trimOuterPTags(content.trim());
        if (token.task) {
          const checkbox = token.checked ? `<span style="${checkedStyle}">\u2713</span>` : `<span style="${uncheckedStyle}"></span>`;
          const textStyle = token.checked ? `color: #999; text-decoration: line-through;` : `color: ${BASE_CONFIG.defaultTextColor};`;
          const result = `<li style="list-style-type: none; margin-left: -20px;">${checkbox}<span style="${textStyle}">${cleanContent}</span></li>`;
          return result;
        }
        const hasNestedList = /<(ul|ol)[^>]*>/.test(cleanContent);
        if (isOrdered) {
          if (hasNestedList) {
            const textContent = cleanContent.replace(/<(ul|ol)[\s\S]*<\/(ul|ol)>/g, "");
            const nestedListMatch = cleanContent.match(/<(ul|ol)[\s\S]*<\/(ul|ol)>/g);
            const nestedListHtml = nestedListMatch ? nestedListMatch.join("") : "";
            const result = `<li style="color: ${listColor};"><span style="color: ${BASE_CONFIG.defaultTextColor};">${textContent}</span>${nestedListHtml}</li>`;
            return result;
          } else {
            const result = `<li style="color: ${listColor};"><span style="color: ${BASE_CONFIG.defaultTextColor};">${cleanContent}</span></li>`;
            return result;
          }
        } else {
          if (hasNestedList) {
            const textContent = cleanContent.replace(/<(ul|ol)[\s\S]*<\/(ul|ol)>/g, "");
            const nestedListMatch = cleanContent.match(/<(ul|ol)[\s\S]*<\/(ul|ol)>/g);
            const nestedListHtml = nestedListMatch ? nestedListMatch.join("") : "";
            const result = `<li style="color: ${listColor}; list-style-type: '${listBullet} ';"><span style="color: ${BASE_CONFIG.defaultTextColor};">${textContent}</span>${nestedListHtml}</li>`;
            return result;
          } else {
            const result = `<li style="color: ${listColor}; list-style-type: '${listBullet} ';"><span style="color: ${BASE_CONFIG.defaultTextColor};">${cleanContent}</span></li>`;
            return result;
          }
        }
      }, "listitem"),
      list: /* @__PURE__ */ __name(function(token) {
        const type = token.ordered ? "ol" : "ul";
        const isOrdered = token.ordered;
        let body = "";
        for (const item of token.items) {
          body += this.listitem(item, isOrdered);
        }
        const cleanBody = body.replace(/>\s+</g, "><");
        const result = `<${type}>${cleanBody}</${type}>`;
        return result;
      }, "list")
    }
  };
}
__name(getListitemRenderer, "getListitemRenderer");
function getCodeRenderer(selectedTheme, THEME_NAME) {
  return {
    renderer: {
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.Code 对象
       */
      code(token) {
        if (!token.lang) {
          token.lang = "text";
        }
        const language = token.lang;
        const codeContent = token.text;
        const lines = codeContent.split("\n");
        let startIndex = 0;
        let endIndex = lines.length - 1;
        while (startIndex < lines.length && lines[startIndex].trim() === "") {
          startIndex++;
        }
        while (endIndex >= 0 && lines[endIndex].trim() === "") {
          endIndex--;
        }
        const trimmedLines = lines.slice(startIndex, endIndex + 1);
        const result = generateWechatCodeBlock(language, trimmedLines);
        return result;
      },
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.Codespan 对象
       */
      codespan(token) {
        const escaped = token.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const result = `<code style="background-color: ${BLUE_THEME.codeBg}; color: ${BLUE_THEME.codeText}; padding: 2px 4px; border-radius: 3px; font-family: Consolas, Monaco, 'Lucida Console', monospace, ${BASE_CONFIG.fontFamily};">${escaped}</code>`;
        return result;
      }
    }
  };
}
__name(getCodeRenderer, "getCodeRenderer");
function getImageRenderer(theme) {
  return {
    renderer: {
      image({ href, title, text }) {
        let out = '<img src="' + href + '" alt="' + text + '"';
        if (title) {
          out += ' title="' + title + '"';
        }
        out += ' style="padding: 8px;"';
        out += ">";
        return out;
      }
    }
  };
}
__name(getImageRenderer, "getImageRenderer");
function getBlockquoteRenderer(theme) {
  const processParagraphsWithLineBreaks = /* @__PURE__ */ __name((content) => {
    return content.replace(/<p([^>]*)>([\s\S]*?)<\/p>/g, (pMatch, pAttributes, pContent) => {
      const processedLines = pContent.split("\n").join("<br>");
      return `<p${pAttributes}>${processedLines}</p>`;
    });
  }, "processParagraphsWithLineBreaks");
  return {
    renderer: {
      blockquote(token) {
        const body = this.parser.parse(token.tokens);
        const alertMatch = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
        if (alertMatch) {
          const alertType = alertMatch[1].toLowerCase();
          let processedContent = body.replace(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n/, "<p>");
          processedContent = processParagraphsWithLineBreaks(processedContent);
          let barColor = "";
          let bgColor = "";
          switch (alertType) {
            case "note":
              barColor = BLUE_THEME.blockquoteAlert.note.barColor;
              bgColor = BLUE_THEME.blockquoteAlert.note.bgColor;
              break;
            case "tip":
              barColor = BLUE_THEME.blockquoteAlert.tip.barColor;
              bgColor = BLUE_THEME.blockquoteAlert.tip.bgColor;
              break;
            case "important":
              barColor = BLUE_THEME.blockquoteAlert.important.barColor;
              bgColor = BLUE_THEME.blockquoteAlert.important.bgColor;
              break;
            case "warning":
              barColor = BLUE_THEME.blockquoteAlert.warning.barColor;
              bgColor = BLUE_THEME.blockquoteAlert.warning.bgColor;
              break;
            case "caution":
              barColor = BLUE_THEME.blockquoteAlert.caution.barColor;
              bgColor = BLUE_THEME.blockquoteAlert.caution.bgColor;
              break;
          }
          const result2 = `<table style="width: 100%; background-image: linear-gradient(to right, ${barColor} 0px, ${barColor} 4px, ${bgColor} 4px, ${bgColor} 100%); border-collapse: collapse; border-radius: 6px; overflow: hidden;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 12px 12px 12px 16px;">
                ${processedContent}
              </td>
            </tr>
          </table>`;
          return result2;
        }
        const processedParagraphs = processParagraphsWithLineBreaks(body);
        const normalBarColor = BLUE_THEME.blockquoteNormal.barColor;
        const normalBgColor = BLUE_THEME.blockquoteNormal.bgColor;
        const result = `<table style="width: 100%; background-image: linear-gradient(to right, ${normalBarColor} 0px, ${normalBarColor} 4px, ${normalBgColor} 4px, ${normalBgColor} 100%); border-collapse: collapse; border-radius: 6px; overflow: hidden;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 12px 12px 12px 16px;">
              ${processedParagraphs}
            </td>
          </tr>
        </table>`;
        return result;
      }
    }
  };
}
__name(getBlockquoteRenderer, "getBlockquoteRenderer");
function getSpaceRenderer() {
  return {
    renderer: {
      space(token) {
        if (token.type === "space" && token.raw) {
          if (/[\r\n]/.test(token.raw)) {
            const isNewlinesOnly = /^[\r\n]+$/.test(token.raw);
            const newlineSequences = token.raw.match(/\r\n|\n|\r/g);
            if (isNewlinesOnly && newlineSequences && newlineSequences.length >= 2) {
              const brCount = newlineSequences.length - 1;
              return "<br>".repeat(brCount);
            }
            const result2 = token.raw.replace(/\r\n|\n|\r/g, "<br>");
            return result2;
          }
          if (token.raw.includes(" ")) {
            const result2 = token.raw.replace(/ /g, "&nbsp;");
            return result2;
          }
        }
        const result = "";
        return result;
      }
    }
  };
}
__name(getSpaceRenderer, "getSpaceRenderer");
function getHrRenderer(theme) {
  return {
    renderer: {
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.Hr 对象
       */
      hr(token) {
        const primaryColor = BLUE_THEME.primary;
        const decorations = BLUE_THEME.decorations;
        if (decorations?.hrSymbol) {
          const result2 = `<section style="display: flex; justify-content: center; align-items: center; width: 100%; height: 30px; margin: 30px 0;">
  <span style="color: ${primaryColor}; font-size: 14px; letter-spacing: 0px;">${decorations.hrSymbol}</span>
</section>`.trim();
          return result2;
        }
        const result = `<section style="display: flex; justify-content: center; align-items: center; width: 100%; height: 30px; margin: 30px 0;">
  <!-- \u7B2C\u4E00\u4E2A\u5706\u70B9 -->
  <span style="width: 6px; height: 6px; border-radius: 50%; background-color: #cccccc;"></span>

  <!-- \u7B2C\u4E8C\u4E2A\u5706\u70B9 -->
  <span style="width: 6px; height: 6px; border-radius: 50%; background-color: ${primaryColor}; margin-left: 10px;"></span>

  <!-- \u7B2C\u4E09\u4E2A\u5706\u70B9 -->
  <span style="width: 6px; height: 6px; border-radius: 50%; background-color: #cccccc; margin-left: 10px;"></span>
</section>`.trim();
        return result;
      }
    }
  };
}
__name(getHrRenderer, "getHrRenderer");
function getBrRenderer() {
  return {
    renderer: {
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.Br 对象
       */
      br(token) {
        return "<br>";
      }
    }
  };
}
__name(getBrRenderer, "getBrRenderer");
function getDelRenderer(theme) {
  return {
    renderer: {
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.Del 对象
       */
      del({ tokens }) {
        const content = this.parser.parseInline(tokens);
        return `<span style="text-decoration: line-through; color: #999;">${content}</span>`;
      }
    }
  };
}
__name(getDelRenderer, "getDelRenderer");
function getLinkRenderer(theme) {
  return {
    renderer: {
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.Link 对象
       */
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        return `<a href="${href}" title="${title || ""}" style="color: ${BLUE_THEME.accent}; text-decoration: underline;">${text}</a>`;
      }
    }
  };
}
__name(getLinkRenderer, "getLinkRenderer");
function getTextRenderer(theme) {
  return {
    renderer: {
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.Text 或 Tokens.Escape 对象
       */
      text(token) {
        if (token.tokens && token.tokens.length > 0) {
          const content2 = this.parser.parseInline(token.tokens);
          return content2;
        }
        const content = token.text;
        if (!content) {
          return false;
        }
        const isProcessedHtml = /^<[^>]+>.*<\/[^>]+>$/.test(content.trim()) || /^<[^>]+\/?>$/.test(content.trim());
        if (isProcessedHtml) {
          return content;
        }
        const alertMatch = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
        if (alertMatch) {
          return false;
        }
        if (content.includes("->")) {
          const arrowFlowRegex = /([^->\n]+?->[^->\n]+(?:->[^->\n]+)*)/g;
          let processedContent2 = content.replace(arrowFlowRegex, (match) => {
            const parts = match.split("->").map((part) => part.trim());
            let result = "";
            for (let i = 0; i < parts.length - 1; i++) {
              if (i > 0) {
                const rightSpan = `<span style="background-color: ${BLUE_THEME.markBg}; color: ${BLUE_THEME.markText}; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${parts[i + 1]}</span>`;
                result += ` -> ${rightSpan}`;
              } else {
                const leftSpan = `<span style="background-color: ${BLUE_THEME.markBg}; color: ${BLUE_THEME.markText}; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${parts[i]}</span>`;
                const rightSpan = `<span style="background-color: ${BLUE_THEME.markBg}; color: ${BLUE_THEME.markText}; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${parts[i + 1]}</span>`;
                result += `${leftSpan} -> ${rightSpan}`;
              }
            }
            return result;
          });
          processedContent2 = processedContent2.replace(/\r\n|\n|\r/g, "<br>");
          const textStyle2 = ``;
          if (processedContent2.trim() !== "") {
            const result = `<span style="${textStyle2}">${processedContent2}</span>`;
            return result;
          }
        }
        const urlPattern = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
        let processedContent = content.replace(urlPattern, (match) => {
          return `<span style="color: ${BLUE_THEME.primary}; font-weight: bold;">${match}</span>`;
        });
        processedContent = processedContent.replace(/\r\n|\n|\r/g, "<br>");
        const textStyle = ``;
        if (processedContent.trim() !== "") {
          const result = `<span style="${textStyle}">${processedContent}</span>`;
          return result;
        }
      }
    }
  };
}
__name(getTextRenderer, "getTextRenderer");
function getTableRenderer(theme) {
  return {
    renderer: {
      /**
       * @param {object} token - 这是新版 marked 传递的 Tokens.Table 对象
       */
      table(token) {
        const header = token.header.map((cell) => this.parser.parseInline(cell.tokens));
        const rows = token.rows.map((row) => {
          return row.map((cell) => this.parser.parseInline(cell.tokens));
        });
        const tableStyle = `
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-family: ${BASE_CONFIG.fontFamily};
          font-size: ${BASE_CONFIG.sizes.content};
        `.trim();
        const thStyle = `
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          padding: 12px 15px;
          text-align: left;
          font-weight: bold;
        `.trim();
        const tdStyle = `
          border: 1px solid #ddd;
          padding: 12px 15px;
          text-align: left;
        `.trim();
        let headerHtml = "<tr>";
        header.forEach((cell, index) => {
          const align = token.align[index];
          let alignStyle = "";
          if (align === "center") alignStyle = "text-align: center;";
          else if (align === "right") alignStyle = "text-align: right;";
          headerHtml += `<th style="${thStyle} ${alignStyle}">${cell}</th>`;
        });
        headerHtml += "</tr>";
        let rowsHtml = "";
        rows.forEach((row) => {
          rowsHtml += "<tr>";
          row.forEach((cell, index) => {
            const align = token.align[index];
            let alignStyle = "";
            if (align === "center") alignStyle = "text-align: center;";
            else if (align === "right") alignStyle = "text-align: right;";
            rowsHtml += `<td style="${tdStyle} ${alignStyle}">${cell}</td>`;
          });
          rowsHtml += "</tr>";
        });
        const result = `
          <table style="${tableStyle}">
            <thead>${headerHtml}</thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `.trim();
        return result;
      }
    }
  };
}
__name(getTableRenderer, "getTableRenderer");
function generateWechatCodeBlock(language, codeLines) {
  if (!language || !codeLines || !Array.isArray(codeLines)) {
    throw new Error("generateWechatCodeBlock: \u53C2\u6570\u4E0D\u5B8C\u6574\u6216\u683C\u5F0F\u9519\u8BEF");
  }
  const themeStyle = {
    content: {
      color: BLUE_THEME.codeBlock.contentText,
      background: BLUE_THEME.codeBlock.contentBg
    },
    outerContainer: {
      "background": BLUE_THEME.codeBlock.outerBg,
      "border": `1px solid ${BLUE_THEME.codeBlock.border}`,
      "border-radius": BLUE_THEME_SETTINGS.codeBlockRadius
    },
    header: {
      background: BLUE_THEME.codeBlock.headerBg,
      color: BLUE_THEME.codeBlock.headerText
    },
    dots: BLUE_THEME.codeBlock.dots
  };
  const LANGUAGE_MAP = {
    // JavaScript相关
    "js": "javascript",
    "javascript": "javascript",
    "jsx": "javascript",
    // TypeScript相关
    "typescript": "typescript",
    "ts": "typescript",
    "tsx": "typescript",
    // 数据格式
    "json": "json",
    "yaml": "yaml",
    "yml": "yaml",
    "xml": "html",
    // 系统语言
    "python": "python",
    "py": "python",
    "java": "java",
    "cpp": "cpp",
    "c": "cpp",
    "c++": "cpp",
    // Web技术
    "html": "html",
    "css": "css",
    "scss": "css",
    "sass": "css",
    // 其他
    "shell": "bash",
    "bash": "bash",
    "sql": "sql",
    "php": "php",
    "go": "go",
    "rust": "rust",
    "ruby": "ruby"
  };
  const mappedLang = LANGUAGE_MAP[language.toLowerCase()] || "text";
  const generateWechatStyles = /* @__PURE__ */ __name((themeStyle2) => ({
    // 外层容器样式 - 必须包含完整的微信兼容属性
    outerContainer: [
      "white-space: pre-wrap",
      "overflow-x: auto",
      `color: ${themeStyle2.content.color}`,
      `background: ${themeStyle2.outerContainer.background}`,
      "text-shadow: none",
      "line-height: 1.5",
      "letter-spacing: .2px",
      "word-spacing: normal",
      "word-break: normal",
      "word-wrap: normal",
      "text-align: left",
      `border: ${themeStyle2.outerContainer.border}`,
      `border-radius: ${themeStyle2.outerContainer["border-radius"]}`,
      "margin: 1em 0",
      "padding: 0"
    ].join("; "),
    // 苹果风格头部样式
    header: [
      "display: flex",
      "justify-content: space-between",
      "align-items: center",
      "font-size: 12px",
      "height: 30px",
      "line-height: 30px",
      `background: ${themeStyle2.header.background}`
    ].join("; "),
    // 工具栏样式
    toolsLeft: "display: flex; align-items: center; padding: 9px 12px; width: 75px;",
    toolsRight: "width: 80px;display: flex; align-items: center;justify-content: center;",
    // 圆点样式生成函数
    getCircleStyle: /* @__PURE__ */ __name((color) => {
      const safeColor = color || "#ff5f57";
      return [
        "display: inline-block",
        "width: 12px",
        "height: 12px",
        "border-radius: 50%",
        `background: ${safeColor}`,
        "box-shadow: 0 0 1px rgba(0, 0, 0, 0.1)"
      ].join("; ");
    }, "getCircleStyle"),
    // 内容区域样式
    innerContainer: [
      "overflow-x: auto",
      `line-height: ${BLUE_THEME_SETTINGS.codeBlockLineHeight}`,
      "margin: 0px",
      `background: ${themeStyle2.content.background}`,
      `color: ${themeStyle2.content.color}`,
      `padding: ${BLUE_THEME_SETTINGS.codeBlockHeaderPadding}`
    ].join("; ")
  }), "generateWechatStyles");
  const wechatStyles = generateWechatStyles(themeStyle);
  const formatCodeLines = /* @__PURE__ */ __name((lines) => {
    return lines.map((line) => `<code style="font-size: ${BASE_CONFIG.sizes.code};">${line}</code>`).join("");
  }, "formatCodeLines");
  const generateAppleHeader = /* @__PURE__ */ __name((styles, colors, mappedLang2) => {
    const redColor = colors.red || "#ff5f57";
    const yellowColor = colors.yellow || "#ffbd2e";
    const greenColor = colors.green || "#28c940";
    const getCircleStyleWithMargin = /* @__PURE__ */ __name((color, marginRight = "0") => {
      const baseStyle = styles.getCircleStyle(color);
      return marginRight ? `${baseStyle}; margin-right: ${marginRight}` : baseStyle;
    }, "getCircleStyleWithMargin");
    const elements = [
      `<section style="${styles.header}">`,
      `<section  style="${styles.toolsLeft}">`,
      `<span  style="${getCircleStyleWithMargin(redColor, "4px")}"></span>`,
      `<span  style="${getCircleStyleWithMargin(yellowColor, "4px")}"></span>`,
      `<span  style="${getCircleStyleWithMargin(greenColor)}"></span>`,
      `</section>`,
      `<section style="${styles.toolsRight}">${mappedLang2}</section>`,
      `</section>`
    ];
    return elements.join("");
  }, "generateAppleHeader");
  const formattedCodeLines = formatCodeLines(codeLines);
  const appleHeader = generateAppleHeader(wechatStyles, themeStyle.dots, mappedLang);
  const codeBlockElements = [
    `<pre class="code-snippet__js code-snippet code-snippet_nowrap" data-lang="${mappedLang}" style="${wechatStyles.outerContainer}">`,
    appleHeader,
    `<pre style="${wechatStyles.innerContainer}">`,
    formattedCodeLines,
    `</pre>`,
    `</pre>`
  ];
  const result = codeBlockElements.join("");
  return result;
}
__name(generateWechatCodeBlock, "generateWechatCodeBlock");

// extension.js
var leftBubbleTemplateSimple = /* @__PURE__ */ __name((text) => `<section style="margin: 15px 0; display: flex; align-items: flex-start; max-width: 100%;"><section style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; flex-shrink: 0; margin-right: 10; z-index: 2;"><img src="https://mmbiz.qpic.cn/mmbiz_png/n3RS3ib3lbz9eb3erDiaTehfcKeIuEOkuMCicQg8P6VjyDD2ey6MCJibBUkBkQ7WC9icz4drEmzN0ZpL2k0duTWE3sQ/0?wx_fmt=png&from=appmsg" alt="\u5934\u50CF" style="width: 100%; height: 100%; object-fit: cover;"></section><section style="display: flex; margin-left: 8px;"><!-- \u4F7F\u7528 border \u6280\u672F\u521B\u5EFA\u4E09\u89D2\u5F62\u5C16\u89D2 --><section style="width: 0; height: 0; border-style: solid; border-width: 8px 9px 8px 0; border-color: transparent #f0f0f0 transparent transparent; align-self: center; z-index: 1; margin-right: -1px;"></section><section style="background-color: #f0f0f0; border-radius: 0 18px 18px 18px; padding: 12px 16px; max-width: 70%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); z-index: 1;"><p style="margin: 0; font-size: 15px; line-height: 1.4; color: #333;">${text}</p></section></section></section>
`, "leftBubbleTemplateSimple");
var rightBubbleTemplateSimple = /* @__PURE__ */ __name((text) => `
<section style="margin: 15px 0; display: flex; align-items: flex-start; justify-content: flex-end; max-width: 100%;"><section style="display: flex; margin-right: 8px;"><section style="background-color: #95ec69; border-radius: 18px 0 18px 18px; padding: 12px 16px; max-width: 70%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); z-index: 1;"><p style="margin: 0; font-size: 15px; line-height: 1.4; color: #000;">${text}</p></section><!-- \u4F7F\u7528 border \u6280\u672F\u521B\u5EFA\u4E09\u89D2\u5F62\u5C16\u89D2 --><section style="width: 0; height: 0; border-style: solid; border-width: 8px 0 8px 9px; border-color: transparent transparent transparent #95ec69; align-self: center; z-index: 1; margin-left: -1px;"></section></section><section style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; flex-shrink: 0; margin-left: 10; z-index: 2;"><img src="https://mmbiz.qpic.cn/mmbiz_png/n3RS3ib3lbz9eb3erDiaTehfcKeIuEOkuMBvmoiaC5BdwPjhv1AZx2NficiaDWjNdia6fkxTjCGUiaeicQR1lClZCiaVTEQ/0?wx_fmt=png&from=appmsg" alt="\u5934\u50CF" style="width: 100%; height: 100%; object-fit: cover;"></section></section>
`, "rightBubbleTemplateSimple");
function getDialogueExtension() {
  const dialogueExtension = {
    name: "dialogue",
    level: "block",
    start(src) {
      const styleMatch = src.match(/^::(simple|original)::\n/);
      if (styleMatch) {
        const nextLineIndex = styleMatch[0].length;
        const nextLine = src.substring(nextLineIndex).match(/^>(L|R):/);
        if (nextLine) {
          return styleMatch.index;
        }
      }
      return src.match(/^>(L|R):/)?.index;
    },
    tokenizer(src, tokens) {
      const styleRule = /^::(simple|original)::\n/;
      const styleMatch = styleRule.exec(src);
      let style = "simple";
      let consumed = 0;
      if (styleMatch) {
        style = styleMatch[1];
        consumed = styleMatch[0].length;
      }
      const dialogueSrc = src.substring(consumed);
      const rule = /^(?:>(L|R): (.*)(?:\n|$))+/i;
      const match = rule.exec(dialogueSrc);
      if (match) {
        const token = {
          type: "dialogue",
          raw: src.substring(0, consumed + match[0].length),
          style,
          // 解析出每一行对话
          dialogues: match[0].trim().split("\n").map((line) => {
            const parts = line.match(/^>(L|R): (.*)/i);
            if (parts) {
              return {
                side: parts[1].toUpperCase() === "L" ? "left" : "right",
                text: parts[2]
              };
            }
            return {
              side: "left",
              text: ""
            };
          })
        };
        return token;
      }
    },
    // 渲染器，将上面 tokenizer 生成的 token 转换成 HTML
    renderer(token) {
      return token.dialogues.map((dialogue) => {
        if (dialogue.side === "left") {
          return leftBubbleTemplateSimple(dialogue.text);
        } else {
          return rightBubbleTemplateSimple(dialogue.text);
        }
      }).join("");
    }
  };
  return dialogueExtension;
}
__name(getDialogueExtension, "getDialogueExtension");
function getHighlightExtension() {
  const highlightExtension = {
    name: "highlight",
    level: "inline",
    start(src) {
      return src.indexOf("==");
    },
    tokenizer: /* @__PURE__ */ __name(function(src, tokens) {
      const rule = /^==([^=]+)==/;
      const match = rule.exec(src);
      if (match) {
        const text = match[1];
        return {
          type: "highlight",
          raw: match[0],
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }, "tokenizer"),
    renderer: /* @__PURE__ */ __name(function(token) {
      const bgColor = BLUE_THEME.markBg;
      const textColor = BLUE_THEME.markText;
      return `<span style="background-color: ${bgColor}; color: ${textColor}; padding: 2px 4px; border-radius: 3px; font-weight: 500;">${this.parser.parseInline(token.tokens)}</span>`;
    }, "renderer")
  };
  return highlightExtension;
}
__name(getHighlightExtension, "getHighlightExtension");

// formula-renderer.js
import path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path3.dirname(__filename2);
var adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
var texInput = new TeX({
  packages: AllPackages
});
var svgOutput = new SVG({
  fontCache: "none",
  scale: 1.2
});
var mj = mathjax.document("", {
  InputJax: texInput,
  OutputJax: svgOutput
});
async function formulaToSvg(formula, isDisplay = true) {
  try {
    let cleanFormula = formula.trim();
    const node = mj.convert(cleanFormula, {
      display: isDisplay
    });
    let svgString = adaptor.outerHTML(node);
    svgString = svgString.replace(/<svg/, '<svg style="vertical-align: middle;"');
    const wrappedHtml = `<section class="block-equation" style="text-align: center; overflow-x: auto; margin: 16px 0;">${svgString}</section>`;
    return wrappedHtml;
  } catch (error) {
    console.error("\u516C\u5F0F\u6E32\u67D3\u5931\u8D25:", formula, error.message);
    return `<p style="text-align: center; color: #ff0000;">[\u516C\u5F0F\u6E32\u67D3\u5931\u8D25: ${formula}]</p>`;
  }
}
__name(formulaToSvg, "formulaToSvg");
async function processFormulas(markdownContent) {
  let result = markdownContent;
  const blockFormulaRegex = /\$\$\s*([\s\S]*?)\s*\$\$/g;
  const blockMatches = Array.from(result.matchAll(blockFormulaRegex));
  for (let i = blockMatches.length - 1; i >= 0; i--) {
    const match = blockMatches[i];
    const fullMatch = match[0];
    const formula = match[1].trim();
    const startIndex = match.index;
    const svgHtml = await formulaToSvg(formula, true);
    result = result.slice(0, startIndex) + svgHtml + result.slice(startIndex + fullMatch.length);
  }
  const inlineFormulaRegex = /(?<!\$)\$([^\$\n]+?)\$(?!\$)/g;
  const inlineMatches = Array.from(result.matchAll(inlineFormulaRegex));
  for (let i = inlineMatches.length - 1; i >= 0; i--) {
    const match = inlineMatches[i];
    const fullMatch = match[0];
    const formula = match[1].trim();
    const startIndex = match.index;
    const svgHtml = await formulaToInlineSvg(formula);
    result = result.slice(0, startIndex) + svgHtml + result.slice(startIndex + fullMatch.length);
  }
  return result;
}
__name(processFormulas, "processFormulas");
function hasFormula(content) {
  if (/\$\$[\s\S]*?\$\$/.test(content)) {
    return true;
  }
  if (/[^\$]\$[^\$\n]+?\$[^\$]/.test(content)) {
    return true;
  }
  return false;
}
__name(hasFormula, "hasFormula");
async function formulaToInlineSvg(formula) {
  try {
    let cleanFormula = formula.trim();
    const node = mj.convert(cleanFormula, {
      display: false
    });
    let svgString = adaptor.outerHTML(node);
    svgString = svgString.replace(/<svg/, '<svg style="display: inline-block; vertical-align: middle;"');
    return svgString;
  } catch (error) {
    console.error("\u884C\u5185\u516C\u5F0F\u6E32\u67D3\u5931\u8D25:", formula, error.message);
    return `<span style="color: #ff0000;">[\u516C\u5F0F\u6E32\u67D3\u5931\u8D25: ${formula}]</span>`;
  }
}
__name(formulaToInlineSvg, "formulaToInlineSvg");

// license.js
import crypto2 from "crypto";
import fs2 from "fs";
import path4 from "path";
import os from "os";

// hardware.js
import { execSync } from "child_process";
import crypto from "crypto";
function execWmic(command) {
  try {
    const result = execSync(command, { encoding: "utf-8", windowsHide: true });
    const lines = result.trim().split("\n").filter((line) => line.trim());
    if (lines.length >= 2) {
      return lines[1].trim();
    }
    return lines[0]?.trim() || "";
  } catch (error) {
    return "";
  }
}
__name(execWmic, "execWmic");
function getCpuId() {
  return execWmic("wmic cpu get ProcessorId");
}
__name(getCpuId, "getCpuId");
function getMotherboardSerial() {
  return execWmic("wmic baseboard get SerialNumber");
}
__name(getMotherboardSerial, "getMotherboardSerial");
function getBiosUuid() {
  return execWmic("wmic csproduct get UUID");
}
__name(getBiosUuid, "getBiosUuid");
function getHardwareInfo() {
  return {
    cpuId: getCpuId(),
    motherboard: getMotherboardSerial(),
    biosUuid: getBiosUuid()
  };
}
__name(getHardwareInfo, "getHardwareInfo");
function getMachineId() {
  const hw = getHardwareInfo();
  const raw = `${hw.cpuId}|${hw.motherboard}|${hw.biosUuid}`;
  const hash = crypto.createHash("md5").update(raw).digest("hex").toUpperCase();
  return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
}
__name(getMachineId, "getMachineId");
function getMachineHash() {
  const hw = getHardwareInfo();
  const raw = `${hw.cpuId}|${hw.motherboard}|${hw.biosUuid}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}
__name(getMachineHash, "getMachineHash");

// license.js
var _k1 = "wan";
var _k2 = "gyi";
var _k3 = "ng";
var getSecretKey = /* @__PURE__ */ __name(() => _k1 + _k2 + _k3, "getSecretKey");
var USAGE_FILE_NAME = ".cache_d7f3a2.tmp";
var BACKUP_DIR_NAME = ".node_cache";
var BACKUP_FILE_NAME = ".session_a1b2c3.dat";
var FREE_TRIAL_COUNT = 6;
function getUsageFilePath() {
  return path4.join(import.meta.dirname, USAGE_FILE_NAME);
}
__name(getUsageFilePath, "getUsageFilePath");
function getUsageBackupPath() {
  const appDataDir = path4.join(os.homedir(), "AppData", "Roaming", BACKUP_DIR_NAME);
  if (!fs2.existsSync(appDataDir)) {
    fs2.mkdirSync(appDataDir, { recursive: true });
  }
  return path4.join(appDataDir, BACKUP_FILE_NAME);
}
__name(getUsageBackupPath, "getUsageBackupPath");
function createSign(data, machineHash) {
  const secret = getSecretKey();
  return crypto2.createHmac("sha256", secret).update(JSON.stringify(data) + machineHash).digest("hex");
}
__name(createSign, "createSign");
function verifySign(data, sign, machineHash) {
  const expectedSign = createSign(data, machineHash);
  return expectedSign === sign;
}
__name(verifySign, "verifySign");
function readUsageData() {
  const mainPath = getUsageFilePath();
  const backupPath = getUsageBackupPath();
  const machineHash = getMachineHash();
  let mainData = null;
  let backupData = null;
  if (fs2.existsSync(mainPath)) {
    try {
      const content = JSON.parse(fs2.readFileSync(mainPath, "utf-8"));
      if (verifySign(content.data, content.sign, machineHash)) {
        mainData = content.data;
      }
    } catch (e) {
    }
  }
  if (fs2.existsSync(backupPath)) {
    try {
      const content = JSON.parse(fs2.readFileSync(backupPath, "utf-8"));
      if (verifySign(content.data, content.sign, machineHash)) {
        backupData = content.data;
      }
    } catch (e) {
    }
  }
  if (!mainData && backupData) {
    return backupData;
  }
  if (mainData && backupData) {
    return mainData.usedCount >= backupData.usedCount ? mainData : backupData;
  }
  return mainData || backupData || null;
}
__name(readUsageData, "readUsageData");
function saveUsageData(data) {
  const machineHash = getMachineHash();
  const sign = createSign(data, machineHash);
  const content = JSON.stringify({ data, sign });
  fs2.writeFileSync(getUsageFilePath(), content, "utf-8");
  try {
    fs2.writeFileSync(getUsageBackupPath(), content, "utf-8");
  } catch (e) {
  }
}
__name(saveUsageData, "saveUsageData");
function initUsageData() {
  const machineHash = getMachineHash();
  const now = Date.now();
  const data = {
    machineHash,
    totalFree: FREE_TRIAL_COUNT,
    usedCount: 0,
    firstUseTime: now,
    lastUseTime: now
  };
  saveUsageData(data);
  return data;
}
__name(initUsageData, "initUsageData");
function getRemainingTrials() {
  const data = readUsageData();
  if (!data) {
    return FREE_TRIAL_COUNT;
  }
  const currentMachineHash = getMachineHash();
  if (data.machineHash !== currentMachineHash) {
    return 0;
  }
  return Math.max(0, data.totalFree - data.usedCount);
}
__name(getRemainingTrials, "getRemainingTrials");
function decrementTrial() {
  let data = readUsageData();
  const currentMachineHash = getMachineHash();
  if (!data) {
    data = initUsageData();
  }
  if (data.machineHash !== currentMachineHash) {
    return 0;
  }
  const now = Date.now();
  if (now < data.lastUseTime - 864e5) {
    data.usedCount = data.totalFree;
  } else {
    data.usedCount++;
  }
  data.lastUseTime = now;
  saveUsageData(data);
  return Math.max(0, data.totalFree - data.usedCount);
}
__name(decrementTrial, "decrementTrial");
function verifyLicense(licenseCode) {
  if (!licenseCode || !licenseCode.trim()) {
    return { valid: false, reason: "NO_LICENSE_CODE" };
  }
  return verifyLicenseCode(licenseCode.trim());
}
__name(verifyLicense, "verifyLicense");
function verifyLicenseCode(licenseKey) {
  if (!licenseKey.startsWith("LICENSE-")) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }
  const hash = licenseKey.substring(8);
  if (hash.length !== 64) {
    return { valid: false, reason: "INVALID_LENGTH" };
  }
  const machineId = getMachineId();
  const machineHash = crypto2.createHash("sha256").update(machineId).digest("hex");
  const expectedPrefix = machineHash.substring(0, 8);
  if (!hash.startsWith(expectedPrefix)) {
    return { valid: false, reason: "MACHINE_MISMATCH" };
  }
  const secret = getSecretKey();
  const expectedSuffix = crypto2.createHash("sha256").update(machineHash + secret).digest("hex").substring(8);
  if (hash.substring(8) !== expectedSuffix) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }
  return { valid: true };
}
__name(verifyLicenseCode, "verifyLicenseCode");
function checkAuthorization(config) {
  const machineId = getMachineId();
  if (config && config.licenseCode && config.licenseCode.trim()) {
    const licenseResult = verifyLicense(config.licenseCode.trim());
    if (licenseResult.valid) {
      return {
        authorized: true,
        isPaid: true,
        remaining: -1,
        // -1 表示无限
        machineId
      };
    }
    return {
      authorized: false,
      isPaid: false,
      remaining: 0,
      machineId,
      licenseError: licenseResult.reason
    };
  }
  const remaining = getRemainingTrials();
  const data = readUsageData();
  if (!data) {
    initUsageData();
  }
  return {
    authorized: remaining > 0,
    isPaid: false,
    remaining,
    machineId
  };
}
__name(checkAuthorization, "checkAuthorization");
function showAuthorizationMessage(authInfo) {
  if (authInfo.isPaid) {
    console.log("\u2713 \u5DF2\u6388\u6743\uFF0C\u6C38\u4E45\u4F7F\u7528");
    return;
  }
  if (authInfo.licenseError) {
    const errorMessages = {
      INVALID_FORMAT: "\u5361\u5BC6\u683C\u5F0F\u9519\u8BEF\uFF0C\u5361\u5BC6\u5E94\u4EE5 LICENSE- \u5F00\u5934",
      INVALID_LENGTH: "\u5361\u5BC6\u957F\u5EA6\u9519\u8BEF",
      MACHINE_MISMATCH: "\u5361\u5BC6\u4E0E\u5F53\u524D\u673A\u5668\u7801\u4E0D\u5339\u914D",
      INVALID_SIGNATURE: "\u5361\u5BC6\u7B7E\u540D\u65E0\u6548"
    };
    const errorMsg = errorMessages[authInfo.licenseError] || "\u5361\u5BC6\u9A8C\u8BC1\u5931\u8D25";
    const licenseKeyPath = path4.join(import.meta.dirname, "license-key.txt");
    console.error(
      [
        "\u2550".repeat(50),
        `\u5361\u5BC6\u9519\u8BEF: ${errorMsg}`,
        "",
        `\u60A8\u7684\u673A\u5668\u7801: ${authInfo.machineId}`,
        "\u8D2D\u4E70\u5361\u5BC6: https://shop.wangchengq.com/details/49742667",
        "\u2550".repeat(50),
        "",
        "\u5361\u5BC6\u6FC0\u6D3B\u540E\u653E\u5230\u6587\u4EF6\u4E2D: " + licenseKeyPath
      ].join("\n")
    );
    return;
  }
  if (authInfo.remaining > 0) {
    console.log(`\u8BD5\u7528\u6A21\u5F0F\uFF1A\u5269\u4F59 ${authInfo.remaining} \u6B21\u514D\u8D39\u4F7F\u7528\u673A\u4F1A`);
    return;
  }
  console.error(
    [
      "\u2550".repeat(50),
      "\u514D\u8D39\u8BD5\u7528\u6B21\u6570\u5DF2\u7528\u5B8C\uFF0C\u8BF7\u8D2D\u4E70\u5361\u5BC6: https://shop.wangchengq.com/details/49742667",
      "\u5361\u5BC6\u6FC0\u6D3B\u540E\u653E\u5230\u6587\u4EF6\u4E2D: " + path4.join(import.meta.dirname, "license-key.txt"),
      "",
      `\u60A8\u7684\u673A\u5668\u7801: ${authInfo.machineId}`,
      "\u2550".repeat(50)
    ].join("\n")
  );
}
__name(showAuthorizationMessage, "showAuthorizationMessage");
function onPublishSuccess(config) {
  const authInfo = checkAuthorization(config);
  if (authInfo.isPaid) {
    return;
  }
  decrementTrial();
}
__name(onPublishSuccess, "onPublishSuccess");

// index.js
process.on("uncaughtException", (err) => {
  console.error(`\u9519\u8BEF\u4FE1\u606F\uFF1A${err.message}`);
  setTimeout(() => process.exit(1), 100);
});
process.on("unhandledRejection", (reason) => {
  if (reason instanceof Error) {
    console.error(`\u9519\u8BEF\u4FE1\u606F\uFF1A${reason.message}`);
  } else {
    console.error(`\u9519\u8BEF\u4FE1\u606F\uFF1A${reason}`);
  }
  setTimeout(() => process.exit(1), 100);
});
function preprocessMarkdownStrong(content) {
  let prevContent;
  do {
    prevContent = content;
    content = content.replace(/([^\s\u200B*_])\*\*/g, "$1\u200B**");
    content = content.replace(/\*\*([^\s\u200B*_])/g, "**\u200B$1");
  } while (content !== prevContent);
  do {
    prevContent = content;
    content = content.replace(/([^\s\u200B_*])__(?!_)/g, "$1\u200B__");
    content = content.replace(/__([^\s\u200B_*])/g, "__\u200B$1");
  } while (content !== prevContent);
  return content;
}
__name(preprocessMarkdownStrong, "preprocessMarkdownStrong");
async function getMergedConfig() {
  const config_inner = {
    debug: false,
    TOKEN_FILE_PATH: path5.join(import.meta.dirname, "wechat-token.json"),
    markedOptions: {
      async: false,
      gfm: true,
      // 启用GitHub Flavored Markdown以支持表格
      breaks: false,
      pedantic: false,
      silent: false
    }
  };
  const argv = yargs(process.argv.slice(2)).parse();
  const configFilePath = argv.config || path5.join(import.meta.dirname, "config.json");
  const mcpWechatOfficialAccountConfig = JSON.parse(await readFile2(configFilePath, "utf-8"));
  const mergedConfig = { ...config_inner, ...mcpWechatOfficialAccountConfig };
  const licenseKeyPath = path5.join(import.meta.dirname, "license-key.txt");
  mergedConfig.licenseCode = (await readFile2(licenseKeyPath, "utf-8")).trim();
  return mergedConfig;
}
__name(getMergedConfig, "getMergedConfig");
async function publishToWechat(mergedConfig, marked) {
  const localMarkdownFilePath = mergedConfig.markdownFilePath;
  if (!await checkFileExists(localMarkdownFilePath)) {
    throw new Error(`Markdown\u6587\u4EF6\u4E0D\u5B58\u5728: ${localMarkdownFilePath}`);
  }
  const accessToken = await checkAndRefreshToken(mergedConfig);
  let markdownContent = await readFile2(localMarkdownFilePath, "utf-8");
  markdownContent = preprocessMarkdownStrong(markdownContent);
  if (hasFormula(markdownContent)) {
    markdownContent = await processFormulas(markdownContent);
  }
  markdownContent = fixListItemsWithExtraText(markdownContent);
  const imageRegex = /!\[(.*?)\]\((?!http)(.*?)\)/g;
  const matches = Array.from(markdownContent.matchAll(imageRegex));
  if (matches.length > 0) {
    for (const match of matches) {
      const markdownTag = match[0];
      const altText = match[1];
      const localPath = match[2];
      let absolutePath = path5.isAbsolute(localPath) ? localPath : path5.resolve(path5.dirname(localMarkdownFilePath), localPath);
      absolutePath = absolutePath.replace(/%20/g, " ");
      const wechatUrl = await uploadContentImage(absolutePath, accessToken, mergedConfig);
      markdownContent = markdownContent.replace(markdownTag, `![${altText}](${wechatUrl})`);
    }
  } else {
  }
  let coverImagePath = path5.join(import.meta.dirname, "cover.jpg");
  if (mergedConfig.coverFilePath && (mergedConfig.coverFilePath.endsWith(".jpg") || mergedConfig.coverFilePath.endsWith(".png"))) {
    coverImagePath = mergedConfig.coverFilePath;
  }
  if (!await checkFileExists(coverImagePath)) {
    throw new Error(`\u5C01\u9762\u56FE\u7247\u4E0D\u5B58\u5728: ${coverImagePath}`);
  }
  let thumbMediaId = "mVlTzdG84QF_OwEOKtacolOthlXTrmZjm67GTL5lYbw9mfHyxJtHwt7SUKTymDfJ";
  if (!mergedConfig.debug) {
    thumbMediaId = await uploadCoverImage(coverImagePath, accessToken, mergedConfig);
  }
  let title = mergedConfig.title || path5.basename(localMarkdownFilePath, ".md");
  title = title.replace(/[<>:"/\\|?*#`{}\[\]()~!@\$%^&+=\\;,'"]/g, "");
  var prefix = mergedConfig.prefix;
  var suffix = mergedConfig.suffix;
  if (!mergedConfig.debug) {
    const parts = [];
    if (prefix) parts.push(prefix);
    parts.push(markdownContent);
    if (suffix) parts.push(suffix);
    markdownContent = parts.join("\n");
  }
  let htmlContent = await marked.parse(markdownContent, mergedConfig.markedOptions);
  htmlContent = htmlContent.trim();
  htmlContent = `<section style="font-size: 15px;text-align: left; line-height: 1.75; color: #595959;">${htmlContent}</section>`;
  let draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`;
  const draftData = {
    articles: [
      {
        title,
        author: mergedConfig.AUTHOR,
        content: htmlContent,
        thumb_media_id: thumbMediaId,
        show_cover_pic: 1
      }
    ]
  };
  let draftResponse = await fetch(draftUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Connection": "close" },
    body: JSON.stringify(draftData)
  });
  let draftResult = await draftResponse.json();
  if (!draftResponse.ok || draftResult.errcode && (draftResult.errcode === 40001 || draftResult.errmsg.includes("invalid credential"))) {
    if (draftResult.errcode === 40001 || draftResult.errmsg.includes("invalid credential")) {
      const newAccessToken = await getAccessToken(mergedConfig);
      draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${newAccessToken}`;
      draftResponse = await fetch(draftUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Connection": "close" },
        body: JSON.stringify(draftData)
      });
      draftResult = await draftResponse.json();
    }
  }
  if (draftResponse.ok && draftResult.media_id) {
    return {
      success: true,
      mediaId: draftResult.media_id,
      message: "\u6210\u529F\u521B\u5EFA\u5FAE\u4FE1\u516C\u4F17\u53F7\u8349\u7A3F"
    };
  } else {
    throw new Error(`\u521B\u5EFA\u5FAE\u4FE1\u516C\u4F17\u53F7\u8349\u7A3F\u5931\u8D25: ${JSON.stringify(draftResult)}`);
  }
}
__name(publishToWechat, "publishToWechat");
function getMarked(mergedConfig) {
  const marked = new Marked();
  const themeName = mergedConfig.theme || "blue";
  setCurrentTheme(themeName);
  const listitemRenderer = getListitemRenderer();
  const codeRenderer = getCodeRenderer(null, themeName);
  const imageRenderer = getImageRenderer();
  const blockquoteRenderer = getBlockquoteRenderer();
  const spaceRenderer = getSpaceRenderer();
  const headingRenderer = getHeadingRenderer();
  const hrRenderer = getHrRenderer();
  const brRenderer = getBrRenderer();
  const delRenderer = getDelRenderer();
  const linkRenderer = getLinkRenderer();
  const textRenderer = getTextRenderer();
  const tableRenderer = getTableRenderer();
  const strongRenderer = getStrongRenderer();
  const emRenderer = getEmRenderer();
  const highlightExtension = getHighlightExtension();
  const dialogueExtension = getDialogueExtension();
  marked.use(headingRenderer, textRenderer, imageRenderer, listitemRenderer, codeRenderer, blockquoteRenderer, spaceRenderer, hrRenderer, brRenderer, delRenderer, linkRenderer, tableRenderer, strongRenderer, emRenderer, {
    extensions: [
      highlightExtension,
      dialogueExtension
    ]
  });
  return marked;
}
__name(getMarked, "getMarked");
(async () => {
  const mergedConfig = await getMergedConfig();
  const authInfo = checkAuthorization(mergedConfig);
  if (!authInfo.authorized) {
    showAuthorizationMessage(authInfo);
    setTimeout(() => process.exit(1), 100);
    return;
  }
  const marked = getMarked(mergedConfig);
  const result = await publishToWechat(mergedConfig, marked);
  if (result.success) {
    onPublishSuccess(mergedConfig);
  }
  console.error("\u53D1\u5E03\u7ED3\u679C:", result);
  setTimeout(() => process.exit(0), 100);
})();
