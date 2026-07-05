---
name: "failed-skill-cleanup"
description: "Cleans up residual skill folders left by failed skill installations in C:\\Users\\Administrator\\.skills-manager\\skills. Invoke when user says skill/技能 installation failed (技能安装失败/skill安装失败) and needs the leftover folder removed."
---

# Failed Skill Cleanup

This skill works around a bug in the skills-manager software where failed skill installations leave behind residual folders that block reinstallation. The software author has not fixed this bug, so this skill manually removes the leftover folder.

## When to Invoke

Trigger this skill when the user indicates that a **skill installation failed** (技能安装失败 / skill安装失败 / 安装失败) and the residual folder needs to be cleaned up.

Do NOT trigger for general installation help, successful installations, or unrelated file deletions.

## What It Does

1. Determine the target skill name (see extraction methods below).
2. Check whether `C:\Users\Administrator\.skills-manager\skills\<skill-name>` exists.
3. If it exists, delete the entire folder.
4. If it does not exist, inform the user that no residual folder was found.

## Determining the Skill Name

There are two ways to identify the skill name. Always try them in this order:

### Method 1: User states the name explicitly

If the user directly provides the skill name, use it as-is.

Example:
- User: "feishu-docx 安装失败了，帮我清理一下" → skill name = `feishu-docx`

### Method 2: Extract from a URL

If the user provides a GitHub/repository link that contains `/skills/<name>`, extract the skill name from the URL.

Extraction rule:
1. Locate the segment `/skills/` in the URL path.
2. Take the **last path segment** that comes after `/skills/`.
3. Strip any trailing slash, query string (`?...`), or fragment (`#...`).

Examples:
- `https://github.com/steelan9199/wechat-publisher/tree/main/skills/feishu-docx` → `feishu-docx`
- `https://github.com/user/repo/tree/main/skills/my-skill/` → `my-skill`
- `https://github.com/user/repo/tree/main/skills/my-skill?tab=readme` → `my-skill`

If the URL does not contain `/skills/`, ask the user to provide the skill name directly.

## Execution Steps

Follow these steps in order. Use the dedicated file tools (Glob, Read, DeleteFile) instead of shell commands where possible.

1. **Resolve the skill name** using Method 1 or Method 2 above. If neither yields a name, ask the user.
2. **Confirm the target path** with the user before deleting:
   - Target: `C:\Users\Administrator\.skills-manager\skills\<skill-name>`
3. **Check existence** of the target folder using `LS` or `Glob` against `C:\Users\Administrator\.skills-manager\skills`.
4. **Delete the folder** if it exists:
   - Prefer the `DeleteFile` tool. Note: `DeleteFile` accepts a list of absolute paths. To delete a folder and its contents, first list its contents with `LS`, delete each child file/subfolder, then delete the folder itself. If `DeleteFile` cannot remove a non-empty directory, fall back to a PowerShell command via `RunCommand`:
     - `Remove-Item -Recurse -Force "C:\Users\Administrator\.skills-manager\skills\<skill-name>"`
5. **Verify deletion** by listing the parent directory again to confirm the folder is gone.
6. **Report the result** to the user:
   - On success: state which folder was deleted and that reinstallation can now be attempted.
   - If the folder did not exist: inform the user no residual was found.

## Important Notes

- Only delete folders under `C:\Users\Administrator\.skills-manager\skills\`. Never delete anything outside this path.
- Always confirm the resolved skill name and full target path with the user before deleting.
- This skill only cleans up leftovers from **failed** installations. Do not use it on folders from currently-working skills unless the user explicitly requests it.
