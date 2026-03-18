| HTTP状态码 | 错误码 | 描述 | 排查建议 |
|:---|:---|:---|:---|
| 400 | 1770001 | invalid param | 确认传入的参数是否合法 |
| 404 | 1770002 | not found | **文档场景中：**<br>文档的 `document_id` 不存在。请确认文档是否已被删除或 `document_id` 是否填写正确。参考[文档概述]了解如何获取文档的 `document_id`。<br><br>**群公告场景中：**<br>群 ID `chat_id` 不存在。请确认群是否被解散或 `chat_id` 是否填写正确。 |
| 400 | 1770003 | resource deleted | 确认资源是否已被删除 |
| 400 | 1770004 | too many blocks in document | 确认文档 Block 数量是否超上限 |
| 400 | 1770005 | too deep level in document | 确认文档 Block 层级是否超上限 |
| 400 | 1770006 | schema mismatch | 确认文档结构是否合法 |
| 400 | 1770007 | too many children in block | 确认指定 Block 的 Children 数量是否超上限 |
| 400 | 1770008 | too big file size | 确认上传的文件尺寸是否超上限 |
| 400 | 1770010 | too many table column | 确认表格列数是否超上限 |
| 400 | 1770011 | too many table cell | 确认表格单元格数量是否超上限 |
| 400 | 1770012 | too many grid column | 确认 Grid 列数量是否超上限 |
| 400 | 1770013 | relation mismatch | 图片、文件等资源的关联关系不正确。请确保在创建图片、文件块时，同时上传了相关图片或文件素材至对应的文档块中。详情参考文档[常见问题 3 和 4] |
| 400 | 1770014 | parent children relation mismatch | 确认 Block 父子关系是否正确 |
| 400 | 1770015 | single edit with multi document | 确认 Block 所属文档与指定的 Document 是否相同 |
| 400 | 1770019 | repeated blockID in document | 确认 Document 中的 BlockID 是否有重复 |
| 400 | 1770020 | operation denied on copying document | 确认 Document 是否正在创建副本中 |
| 400 | 1770021 | too old document | 确认指定的 Document 版本（Revision_id）是否过旧。指定的版本号与文档最新版本号差值不能超过 1000 |
| 400 | 1770022 | invalid page token | 确认查询参数中的 page_token 是否合法 |
| 400 | 1770024 | invalid operation | 确认操作是否合法：<br>• 除了 text_run，其他 text_element 不允许设置 link 属性<br>• 编辑请求中 text_element 中不允许设置 undefined 元素<br>• 分栏的列数范围在 [2, 10] 之间，不允许减少或者增加分栏列数超过约定范围<br>• 表格只有一行或者一列时，不允许通过减少表格行列的请求操作表格 |
| 400 | 1770025 | operation and block not match | 确认指定 Block 应用对应操作是否合法 |
| 400 | 1770026 | row operation over range | 确认行操作下标是否越界 |
| 400 | 1770027 | column operation over range | 确认列操作下标是否越界 |
| 400 | 1770028 | block not support create children | 确认指定 Block 添加 Children 是否合法 |
| 400 | 1770029 | block not support to create | 确认指定 Block 是否支持创建 |
| 400 | 1770030 | invalid parent children relation | 确认指定操作其父子关系是否合法 |
| 400 | 1770031 | block not support to delete children | 确认指定 Block 是否支持删除 Children |
| 400 | 1770033 | content size exceed limit | 纯文本内容大小超过 10485760 字符限制，请减少内容后重试。 |
| 400 | 1770034 | operation count exceed limited | 当前请求中涉及单元格个数过多，请拆分成多次请求 |
| 400 | 1770035 | resource count exceed limit | 当前请求中资源的数目超限，请拆分成多次请求。各类资源上限为：ChatCard 200 张，File 200 个，MentionDoc 200 个，MentionUser 200 个，Image 20 张，ISV 20 个，Sheet 5 篇，Bitable 5 篇。 |
| 400 | 1770038 | resource not found | 未查询到插入的资源或资源无权限插入，请检查资源标识是否正确。 |
| 403 | 1770032 | forbidden | **文档场景中：**<br>确认当前调用身份是否有文档阅读（获取相关接口）或编辑（更新、删除、创建相关接口）权限。|
| 500 | 1771001 | server internal error | 服务器内部错误。请重试，若仍无法解决请咨询[技术支持]。 |
| 500 | 1771002 | gateway server internal error | 网关服务内部错误。请重试，若仍无法解决请咨询[技术支持]。 |
| 500 | 1771003 | gateway marshal error | 网关服务解析错误。请重试，若仍无法解决请咨询[技术支持]。 |
| 500 | 1771004 | gateway unmarshal error | 网关服务反解析错误。请重试，若仍无法解决请咨询[技术支持]。 |
| 500 | 1771006 | mount folder failed | 挂载文档到云空间文件夹失败。请检查是否错误地传入了 wiki_token 并重试。若仍无法解决请咨询[技术支持]。 |
| 503 | 1771005 | system under maintenance | 系统服务正在维护中，请重试，若仍无法解决请咨询[技术支持] |
