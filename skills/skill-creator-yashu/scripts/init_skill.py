"""
Skill Initializer - Creates a new skill from template

Usage:
    python init_skill.py <skill-name> --path <path>

Examples:
    python init_skill.py my-new-skill --path skills/public
    python init_skill.py my-api-helper --path skills/private
    init_skill.py custom-skill --path /custom/location
"""

import sys
from pathlib import Path

from skill_templates import (
    get_skill_template,
    get_example_script,
    get_example_reference,
    EXAMPLE_ASSET,
)


def title_case_skill_name(skill_name):
    """Convert hyphenated skill name to Title Case for display."""
    return " ".join(word.capitalize() for word in skill_name.split("-"))


def init_skill(skill_name, path):
    """
    Initialize a new skill directory with template SKILL.md.

    Args:
        skill_name: Name of the skill
        path: Path where the skill directory should be created

    Returns:
        Path to created skill directory, or None if error
    """
    # Determine skill directory path
    skill_dir = Path(path).resolve() / skill_name

    # Check if directory already exists
    if skill_dir.exists():
        print(f"❌ Error: Skill directory already exists: {skill_dir}")
        return None

    # Create skill directory
    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
        print(f"✅ Created skill directory: {skill_dir}")
    except Exception as e:
        print(f"❌ Error creating directory: {e}")
        return None

    # Create SKILL.md from template
    skill_title = title_case_skill_name(skill_name)
    skill_content = get_skill_template(skill_name, skill_title)

    skill_md_path = skill_dir / "SKILL.md"
    try:
        skill_md_path.write_text(skill_content, encoding="utf-8")
        print("✅ Created SKILL.md")
    except Exception as e:
        print(f"❌ Error creating SKILL.md: {e}")
        return None

    # Create resource directories with example files
    try:
        # Create scripts/ directory with example script
        scripts_dir = skill_dir / "scripts"
        scripts_dir.mkdir(exist_ok=True)
        example_script = scripts_dir / "example.py"
        example_script.write_text(
            get_example_script(skill_name), encoding="utf-8"
        )
        example_script.chmod(0o755)
        print("✅ Created scripts/example.py")

        # Create references/ directory with example reference doc
        references_dir = skill_dir / "references"
        references_dir.mkdir(exist_ok=True)
        example_reference = references_dir / "api_reference.md"
        example_reference.write_text(
            get_example_reference(skill_title), encoding="utf-8"
        )
        print("✅ Created references/api_reference.md")

        # Create assets/ directory with example asset placeholder
        assets_dir = skill_dir / "assets"
        assets_dir.mkdir(exist_ok=True)
        example_asset = assets_dir / "example_asset.txt"
        example_asset.write_text(EXAMPLE_ASSET, encoding="utf-8")
        print("✅ Created assets/example_asset.txt")
    except Exception as e:
        print(f"❌ Error creating resource directories: {e}")
        return None

    # Print next steps
    print(f"\n✅ Skill '{skill_name}' initialized successfully at {skill_dir}")
    print("\nNext steps:")
    print("1. Edit SKILL.md to complete the TODO items and update the description")
    print(
        "2. Customize or delete the example files in scripts/, references/, and assets/"
    )
    print("3. Run the validator when ready to check the skill structure")

    return skill_dir


def main():
    if len(sys.argv) < 4 or sys.argv[2] != "--path":
        print("Usage: init_skill.py <skill-name> --path <path>")
        print("\nSkill name requirements:")
        print("  - Kebab-case identifier (e.g., 'my-data-analyzer')")
        print("  - Lowercase letters, digits, and hyphens only")
        print("  - Max 64 characters")
        print("  - Must match directory name exactly")
        print("\nExamples:")
        print("  init_skill.py my-new-skill --path skills/public")
        print("  init_skill.py my-api-helper --path skills/private")
        print("  init_skill.py custom-skill --path /custom/location")
        sys.exit(1)

    skill_name = sys.argv[1]
    path = sys.argv[3]

    print(f"🚀 Initializing skill: {skill_name}")
    print(f"   Location: {path}")
    print()

    result = init_skill(skill_name, path)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
