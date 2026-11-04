# Local Facebook session companion

From the Miftan directory on Windows, run:

```powershell
py -m venv companion/.venv
companion/.venv/bin/python -m pip install -r companion/requirements.txt
companion/.venv/bin/python -m playwright install chromium
companion/.venv/bin/python companion/facebook_session.py --profile myaccount
```

On Linux, macOS or WSL with a graphical session, run:

```sh
python3 -m venv companion/.venv
companion/.venv/bin/python -m pip install -r companion/requirements.txt
companion/.venv/bin/python -m playwright install chromium
companion/.venv/bin/python companion/facebook_session.py --profile myaccount
```

Sign in manually in the opened window, then press Enter in the terminal. Reuse the same profile name on the next launch. Browser data stays in the operating system's per-user application data directory. To disconnect, log out in that browser profile.

## Discover source suggestions

Run the same command with `--discover`. In the browser, open the joined groups and followed pages lists when prompted. The tool scrolls through the rendered lists and writes a local JSON file with names, links and source types. Layout changes and incomplete loading can affect results.

In Miftan, go to **ניהול המקורות שלי → מקורות מוצעים**, choose the generated file, review the suggestions, then add the selected sources. Use discovery within the authorized scope. Post collection remains disabled.
