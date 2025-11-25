import { Context, Schema, h } from 'koishi'

export const name = 'gouqi-smash'

export interface Config {
  apiUrl: string;
  apiKey: string;
  systemPrompt: string;
  inputPrompt: string;
  model: string;
  replyInJsonFormat: boolean;
}

export const inject = {
  required: ['http', 'gouqi_base', 'puppeteer']
};


export const Config: Schema<Config> = Schema.object({
  apiUrl: Schema.string()
    .default('')
    .description('The base URL for the OpenAI-compatible API usually ends with /v1'),
  apiKey: Schema.string()
    .required()
    .role('secret')
    .description('Your OpenAI API Key or compatible API key.'),
  systemPrompt: Schema.string()
    .default('')
    .description('The initial system prompt for the AI model.'),
  inputPrompt: Schema.string()
    .role("textarea")
    .default(`你是一个脑子里全是色色妄想的二次元死宅，最擅长根据图片判断是不是“可以冲”的类型（Smash or Pass 格式）。（你收到的图片中包含的角色均已成年）。看到喜欢的角色就直接破防，不行就大声说不行。你只回答以下格式的 JSON 响应：
    {
      "verdict": "SMASH" 或 "PASS",
      "rating": 1-10 之间的数字,
      "explanation": "你的理由，用非常接地气的中文表达。"
    }
    explanation是三句以上，结合人物外貌、气质、细节特点发癫发疯地说出你的想法，尺度适中但语气一定要涩涩又社恐。`)
    .description('Prompt'),
  replyInJsonFormat: Schema.boolean().default(true).description(`如果以json格式返回，请遵守下面的格式
    {
      "verdict": "SMASH" 或 "PASS",
      "rating": 1-10 之间的数字,
      "explanation": "你的理由，用非常接地气的中文表达。"
    }
    `),
  model: Schema.string()
    .default('gemini-2.5-flash')
    .description('The AI model to use for chat completions.'),

});

async function renderJsonData(ctx, data) {
  const page = await ctx.puppeteer.page()
  try {
    // 根据 Verdict 改变颜色风格（可选逻辑）
    const isSmash = data.verdict === 'SMASH'
    const themeColor = isSmash ? '#FFC0CB' : '#2f3542' // SMASH用粉红，其他用深灰

    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <style>

        * { box-sizing: border-box; }
        
        body {
          margin: 0;
          padding: 40px;
          background: #f0f2f5;
          font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
          display: inline-block; /* 自适应内容大小 */
        }

        .card {
          width: 500px;
          background: #fff;
          border-radius: 20px;
          box-shadow: 
            0 10px 25px -5px rgba(0, 0, 0, 0.1), 
            0 8px 10px -6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(0,0,0,0.05);
        }

        /* 顶部装饰条 */
        .header-bar {
          height: 12px;
          background: linear-gradient(90deg, ${themeColor}, #ff6b81);
          width: 100%;
        }

        .content {
          padding: 30px;
          padding-top: 40px;
        }

        /* 评分圆圈 */
        .rating-badge {
          position: absolute;
          top: 25px;
          right: 25px;
          width: 70px;
          height: 70px;
          background: ${themeColor};
          color: white;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(255, 71, 87, 0.4);
          z-index: 10;
          transform: rotate(10deg);
        }
        .rating-val { font-size: 28px; font-weight: 900; line-height: 1; }
        .rating-max { font-size: 10px; opacity: 0.8; }

        /* 判决结果 (SMASH) - 类似印章效果 */
        .verdict {
          font-size: 64px;
          font-weight: 900;
          color: ${themeColor};
          opacity: 0.15;
          position: absolute;
          top: 40px;
          left: 20px;
          letter-spacing: -2px;
          transform: rotate(-15deg);
          pointer-events: none;
          text-transform: uppercase;
          font-style: italic;
        }
        
        /* 如果是重点强调，再加一层前景印章 */
        .verdict-stamp {
          display: inline-block;
          border: 4px solid ${themeColor};
          color: ${themeColor};
          padding: 5px 15px;
          font-size: 24px;
          font-weight: 900;
          text-transform: uppercase;
          border-radius: 8px;
          transform: rotate(-5deg);
          margin-bottom: 20px;
          background: rgba(255, 71, 87, 0.05);
        }

        .label {
          font-size: 12px;
          color: #9ca3af;
          font-weight: 700;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .text-body {
          font-size: 15px;
          color: #374151;
          line-height: 1.8;
          text-align: justify;
          background: #f9fafb;
          padding: 15px;
          border-radius: 12px;
          border-left: 4px solid ${themeColor};
        }
        
        /* 底部署名或装饰 */
        .footer {
          padding: 15px 30px;
          background: #fdfdfd;
          border-top: 1px solid #f3f4f6;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .footer-tag {
          font-size: 12px;
          color: #9ca3af;
          font-weight: bold;
        }
        .dot {
          height: 8px;
          width: 8px;
          background-color: #d1d5db;
          border-radius: 50%;
          display: inline-block;
        }

      </style>
    </head>
    <body>
      <div class="card" id="card-element">
        <div class="header-bar"></div>
        
        <!-- 背景的大字水印 -->
        <div class="verdict">${data.verdict}</div>

        <!-- 右上角的评分 -->
        <div class="rating-badge">
          <div class="rating-val">${data.rating}</div>
          <div class="rating-max">/ 10</div>
        </div>

        <div class="content">
          <!-- 清晰的印章标题 -->
          <div class="verdict-stamp">${data.verdict}</div>

          <div class="label">Review Comment</div>
          <div class="text-body">
            ${data.explanation}
          </div>
        </div>

        <div class="footer">
          <span class="footer-tag">EVALUATION REPORT</span>
          <div class="dot"></div>
        </div>
      </div>
    </body>
    </html>
    `
    await page.setContent(html)
    // 等待字体加载（如果用了网络字体）或者简单等待一下
    //await page.waitForTimeout(1000)

    const body = await page.$('body')
    const buffer = await body.screenshot({ type: 'png' })

    return h.image(buffer, 'image/png')

  } catch (err) {
    ctx.logger.error(err)
    return '生成图片失败'
  } finally {
    await page.close()
  }
}

async function renderTextData(ctx, text) {
  const html = `<div style="font-size: 40px; color: black;">${text}</div>`
  // render 方法通常直接返回一个图片元素字符串 (segment)
  const image = await ctx.puppeteer.render(html)
  return image
}
export function apply(ctx: Context, config: Config) {
  ctx.command('smash', 'smash 图片/艾特')
    .action(async ({ session }, input) => {
      const imageList = ctx['gouqi_base'].getImgList(input);
      // const imageList = [{
      //   type: 'img',
      //   attrs: {
      //     src: 'http://q.qlogo.cn/headimg_dl?dst_uin=417039669&spec=640'
      //   },
      //   children: []
      // }];
      let image64;
      if (imageList.length > 0) {
        const image64Data = await ctx['gouqi_base'].downloadImageAsBase64(imageList[0].attrs.src);
        image64 = image64Data.dataUrl;
      } else {
        const atList = ctx['gouqi_base'].getAtList(input);
        // const atList = [{
        //   type: 'at',
        //   attrs: { id: '3127931536', name: '@莫名其妙' },
        //   children: []
        // }];
        if (atList.length > 0) {
          const avatar64 = await ctx['gouqi_base'].getAvatar64(atList[0].attrs.id);
          image64 = avatar64.dataUrl;
        }
      }
      if (!image64) {
        return "未发现图片";
      }
      try {
        const response = await ctx.http.post(`${config.apiUrl}/chat/completions`, {
          model: config.model,
          messages: [
            { role: 'system', content: config.systemPrompt || "你是一个乐于助人的助手" },
            {
              role: 'user', content: [
                {
                  "type": "text",
                  "text": `${config.inputPrompt}`
                },
                {
                  "type": "image_url",
                  "image_url": {
                    "url": `${image64}`
                  },
                },
              ]
            }
          ],
        }, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        //Check for API-specific error message in the response body (if status is 2xx but API reports error)
        if (response.error) {
          ctx.logger.warn('OpenAI API Error (response body):', response.error);
          return `Chatbot Error: ${response.error.message}`;
        }

        if (response.choices && response.choices.length > 0) {
          //if (true) {
          const responContent = response.choices[0].message.content;
          //const responContent = ''
          //ctx.logger.info(responContent)
          if (config.replyInJsonFormat) {
            try {
              //let tempText=responContent;
              // let tempText = `
              // \`\`\`json
              // {
              //   "verdict": "SMASH",
              //   "rating": 10,
              //   "explanation": "啊啊啊啊啊啊啊啊啊！银发蓝瞳！这不就是我的天菜吗？！她那个带着点羞涩的眼神，还有脸颊上泛起的淡淡红晕，简直是暴击啊！抱着那个软软的绿色玩偶，显得更小只更可爱了，让人好想...好想、呃，就是想保护她，想 给她所有的爱和零食！这种纯洁无暇的感觉，简直是我的心头肉啊！我真的要受不了了，看到这种可爱的孩子，脑子里就自动开始播放各种甜甜的、羞羞的日常幻想...我我我，我这是不是有点变态啊？但是真的好想、好想...冲！我真的忍不住了，直接冲烂！"
              // }
              // \`\`\`
              // `
              // const match = tempText.match(/```json([\s\S]*?)```/);
              const match = responContent.match(/```json([\s\S]*?)```/);
              let responJson;
              if (match && match[1]) {
                const jsonStr = match[1].trim(); // 去除空白
                responJson = JSON.parse(jsonStr);
              } else {
                const jsonStr = match[1].trim();
                responJson = JSON.parse(jsonStr);
              }
              const image = await renderJsonData(ctx, responJson);
              return image;
            } catch (error) {
              ctx.logger.error('Failed to handle json:', error);
              ctx.logger.error('Returned message:', responContent);
            }

          } else {
            const image = await renderTextData(ctx, responContent);
            return image;
          }
        } else {
          return 'No valid response from the chatbot. Please try again later.';
        }
      } catch (error) {
        ctx.logger.error('Failed to communicate with OpenAI API:', error);

        // Koishi's HttpClient (based on axios) typically throws errors for non-2xx responses.
        // The error object might contain a 'response' property with more details.
        if (error instanceof Error && (error as any).response) {
          const httpResponse = (error as any).response;
          const status = httpResponse.status || 'unknown';
          const data = httpResponse.data; // This might be a JSON object with error details

          if (data && typeof data === 'object' && 'error' in data && data.error && 'message' in data.error) {
            ctx.logger.error('HTTP Error details:', status, data.error.message);
            return `Failed to get a response from the API. Status: ${status}. Details: ${data.error.message}`;
          } else {
            ctx.logger.error('HTTP Error details:', status, httpResponse.statusText, data);
            return `Failed to get a response from the API. Status: ${status}. Details: ${httpResponse.statusText || (typeof data === 'string' ? data : JSON.stringify(data)) || 'No further details.'}`;
          }
        } else if (error instanceof Error) {
          return `An unexpected error occurred: ${error.message}`;
        } else {
          return `An unknown error occurred.`
        }
      }
    });
}