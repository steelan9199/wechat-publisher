| 错误码 | 描述 | 排查建议 |
|:---|:---|:---|
| 10003 | invalid parameter | 请求参数缺失或者有误，更多错误信息请参考请求返回的error message |
| 99991663 | Invalid access token for authorization. Please make a request with token attached | 请求所使用的访问凭证无效。原因可能是 tenant_access_token 已过期 |
| 1770001 | invalid param | 确认传入的参数是否合法 |
| 1770002 | not found | **文档场景中：**<br>文档的 `document_id` 不存在。请确认文档是否已被删除或 `document_id` 是否填写正确。参考[文档概述]了解如何获取文档的 `document_id`。<br><br>**群公告场景中：**<br>群 ID `chat_id` 不存在。请确认群是否被解散或 `chat_id` 是否填写正确。 |
| 1770003 | resource deleted | 确认资源是否已被删除 |
| 1770015 | single edit with multi document | 确认 Block 所属文档与指定的 Document 是否相同 |
| 1770019 | repeated blockID in document | 确认 Document 中的 BlockID 是否有重复 |
| 1770022 | invalid page token | 确认查询参数中的 page_token 是否合法 |
| 1770024 | invalid operation | 确认操作是否合法：<br>• 除了 text_run，其他 text_element 不允许设置 link 属性<br>• 编辑请求中 text_element 中不允许设置 undefined 元素<br>• 分栏的列数范围在 [2, 10] 之间，不允许减少或者增加分栏列数超过约定范围<br>• 表格只有一行或者一列时，不允许通过减少表格行列的请求操作表格 |
| 1770030 | invalid parent children relation | 确认指定操作其父子关系是否合法 |
| 1770031 | block not support to delete children | 确认指定 Block 是否支持删除 Children |
| 1770033 | content size exceed limit | 纯文本内容大小超过 10485760 字符限制，请减少内容后重试。 |
| 1770034 | operation count exceed limited | 当前请求中涉及单元格个数过多，请拆分成多次请求 |
| 1770035 | resource count exceed limit | 当前请求中资源的数目超限，请拆分成多次请求。各类资源上限为：ChatCard 200 张，File 200 个，MentionDoc 200 个，MentionUser 200 个，Image 20 张，ISV 20 个，Sheet 5 篇，Bitable 5 篇。 |
| 1770038 | resource not found | 未查询到插入的资源或资源无权限插入，请检查资源标识是否正确。 |
| 1770032 | forbidden | **文档场景中：**<br>确认当前调用身份是否有文档阅读（获取相关接口）或编辑（更新、删除、创建相关接口）权限。|

### 云空间文件夹管理错误码

| 错误码 | 描述 | 排查建议 |
|:---|:---|:---|
| 1061003 | not found | 文件或文件夹不存在，或 `type` 参数与实际文件类型不匹配。请确认 `file_token` 是否正确，以及 `type` 参数是否为正确的文件类型（具体支持类型因接口而异，请参考各接口文档） |
| 1061004 | forbidden | 权限不足。需在浏览器中打开文件夹链接，点击分享按钮，将飞书企业自建应用添加为协作者并赋予「可管理」权限 |
| 1061045 | 频率超限 | 云空间写入类接口（新建文件夹、删除文件、批量删除等）频率超限，上限为 5 QPS 和 10000 次/天。请稍后重试 |
| 1062501 | operate node no permission | 文件夹位于根目录下（`parent_id` 为 `"0"`），飞书企业自建应用无法获取根目录编辑权限，删除必然失败。请用户在飞书客户端手动删除 |
| 1062507 | 节点超限 | 云空间中根目录或文件夹的单层节点上限为 1500 个。请将新文件夹创建到其它文件夹中 |
| 1062535 | destination parent no permission | 目标文件夹无权限。需在浏览器中打开目标文件夹链接，将飞书企业自建应用添加为协作者并赋予「可管理」权限 |

### 文件元数据错误码

| 错误码 | 描述 | 排查建议 |
|:---|:---|:---|
| 1069701 | User identity verification failed | 检查 appid 是否正确 |
| 1069704 | Internal server error | 服务端错误，稍后重试；若仍报错可联系技术支持 |

### 搜索错误码

| 错误码 | 描述 | 排查建议 |
|:---|:---|:---|
| 91201 | FAILED | 处理失败，请稍后重试或联系飞书技术支持 |
| 91204 | FORBIDDEN | 当前应用或用户没有权限。搜索云文档需开启 `docs:doc:readonly`、`docs:doc` 或 `search:document:readonly` 权限；获取根文件夹元数据需开启 `drive:drive` 或 `drive:drive:readonly` 权限 |

### Wiki 知识库错误码

| 错误码 | 描述 | 排查建议 |
|:---|:---|:---|
| 10001 | invalid param | 参数错误，检查输入参数（如 query 超过 50 字符、node_id 未传 space_id 等） |
| 10002 | network anomaly, please try again | 后端服务异常或网络异常，可重新请求 |
| 131001 | rpc fail | 服务报错，稍后重试 |
| 131002 | param err | 检查参数类型是否正确，如 `node_token`、`folder_token` 是否为字符串 |
| 131003 | out of limit | 超过接口频率或业务限制，降低频率后重试 |
| 131004 | invalid user | 核对调用身份的账号状态与权限有效性 |
| 131005 | not found | 核对 `node_token`、`folder_token` 是否正确，确认资源未被删除 |
| 131006 | permission denied | 在知识库和目标云空间文件夹中均添加应用为协作者并赋予「可管理」权限 |
| 131007 | internal err | 服务内部错误，请勿重试，联系技术支持 |
| 131008 | already exists | 目标位置存在同名资源，调整资源名称或更换路径后重试 |

### 鉴权错误码

| 错误码 | 描述 | 排查建议 |
|:---|:---|:---|
| 10013 | invalid app_id | app_id 无效，请检查 app_id 是否正确 |

### 在浏览器中将飞书企业自建应用添加为文件夹协作者并赋予「可管理」权限的详细步骤

1. 获取飞书云文档文件夹的链接
2. 在浏览器中打开文件夹链接
3. 点击右侧的分享按钮，会出现「分享文件夹」弹窗
4. 点击「邀请协作者」右侧的加号按钮，会弹出一个选择联系人的界面
5. 在输入框中输入飞书企业自建应用的名字
6. 勾选你创建的飞书企业自建应用，点击确认按钮
7. 将权限从「可阅读」改为「可管理」，再点击发送按钮
