# 🍕 pizza

These are commands I use with agents, mostly pi.

## Install

```bash
# Install dependencies first
pi install git:github.com/ghoseb/pi-askuserquestion

# Then install this package
pi install git:github.com/edwrdc/pizza
```

## What's Inside

| Directory | Contents |
|-----------|----------|
| `extensions/` | Custom pi extensions |
| `prompts/` | Reusable prompt templates |
| `skills/` | Custom skills |
| `themes/` | Custom themes |

## Development

```bash
# Clone for development
cd ~/code
git clone git@github.com:edwrdc/pizza.git

# Symlink to pi's extensions
ln -s ~/code/pizza/extensions ~/.pi/agent/extensions/pizza-dev

# Reload pi after changes
/reload
```

## License

MIT
