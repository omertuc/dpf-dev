# DPF Dev GUI

A local web console for the "redeploy my DPF dev cluster on a hypervisor" loop:

1. See the hypervisor's VMs and free memory, and whether you already have something deployed
2. `git pull` the automation repo
3. `make clean-all` and verify your VMs are really gone
4. Push your `user.env` and run `make generate-env`
5. `make all`, with live progress through its steps
6. Fetch the management and hosted cluster kubeconfigs locally

```sh
./dpf-dev gui          # http://127.0.0.1:8765
./dpf-dev gui --open   # ...and open the browser
```

Shortcuts: <kbd>R</kbd> refresh, <kbd>L</kbd> open the log, <kbd>E</kbd> edit config, <kbd>Esc</kbd> close.

## Command line

The rest of `./dpf-dev` does the same without the browser: profiles, settings and their checks, picking a
hypervisor, DPU hosts, an HBN slot and a lab domain, and deploys. It uses the same profiles and
the same jobs on the hypervisor as the GUI, so you can switch between the two at any point: a
deploy started from one shows up in the other. The cluster views are only in the GUI.

```sh
./dpf-dev whoami <your-github-login>       # lab machines and HBN slots are allocated to it
./dpf-dev hypervisors                      # the lab's hypervisors, and whether you can log in
./dpf-dev profile create mine --host nvd-srv-45   # finds (or --clone's) ~/user-envs/<you>/mine/openshift-dpf
export DPF_DEV_PROFILE=mine                # or -p mine on every command
./dpf-dev domain doca5                     # or: set CLUSTER_NAME=… BASE_DOMAIN=…, then vips --use
./dpf-dev dpu list                         # lab DPU hosts and who has them
./dpf-dev dpu add nvd-srv-25               # next worker slot; asks the BMC for the boot NIC
./dpf-dev slot auto                        # your HBN slot with room for your DPU hosts
./dpf-dev set RAM=65536 --note "bigger"    # get / unset / disable / enable / env
./dpf-dev check [--fix]                    # the GUI's validation; exits 1 on errors
./dpf-dev deploy                           # pull → clean-all (if you have VMs) → make all → kubeconfigs
./dpf-dev logs -f / jobs / status / cancel
```

`deploy` refuses to start while the settings have errors (`--force` to start anyway), lists what
the clean-up will destroy and asks first (`--yes` to skip that), then follows the log. Ctrl-C
only stops watching; the job keeps running on the hypervisor. `run <stage>…` runs single stages,
such as `run clean-vms`. Most read commands take `--json`. `./dpf-dev <command> --help` has the rest.

## How it works

- **SSH**: uses your system `ssh` (keys, agent and `~/.ssh/config` all apply) with its own
  ControlMaster, and overrides `RemoteCommand`/`RequestTTY`, so it doesn't attach to your tmux.
- **Jobs**: each action runs on the hypervisor as a detached script (`setsid nohup`), so it keeps going
  when you close the tab, stop this server or lose your VPN. Scripts, logs and exit codes are kept in
  `~/.dpf-gui/<automation-dir>/` on the hypervisor, outside the repo. Only one job runs per automation dir
  at a time. The app also warns you if a `make` you started by hand is running there.
- **Progress**: `make all` runs with `--debug=b`, and the UI turns make's "Must remake target" lines into
  step progress through `ALL_STEPS`. The debug noise is hidden in the log viewer; toggle "Show make
  trace" to see it. The `logs/make_all_*.log` that the repo writes contains those lines as well.
- **"Yours"**: VMs whose names start with `VM_PREFIX` / `VM_WORKER_PREFIX` from the hypervisor's `.env`.
- **Kubeconfigs**: the management one is `$KUBECONFIG` from the hypervisor's `.env`. The hosted one is
  decoded on the hypervisor from the `<HOSTED_CLUSTER_NAME>-admin-kubeconfig` secret (default namespace
  `dpf-operator-system`). After a deploy that included `make all`, both are fetched automatically.

## Profiles and settings

A **profile** is one deployment: the hypervisor it runs on (picked from `lab-machines.yaml` in [dpf-allocations](https://github.com/rh-ecosystem-edge/dpf-allocations), from a clone the app keeps under its state directory and pulls), where the
automation repo is checked out there, its DPU hosts and its settings. To start from another profile's
settings, duplicate it.

Settings are structured data, not shell files. A profile's own values override the automation repo's
defaults (`ci/env.defaults`, read live from the hypervisor). The Settings view groups related settings
into cards (cluster address and DNS, versions, VMs, DPU hosts, network, pull secrets, hosted cluster),
with everything else in a plain list. It explains each setting and validates it against the repo and
the live hypervisor (bridge MTU, VIPs in the right subnet and unused, pull secrets present, memory and
disk, version alignment, DNS records, BMC logins, and so on). A setting can carry a note, and you can
switch it off without deleting it. On push the app generates the hypervisor's `user.env` from the
profile's settings and runs `make generate-env`.

## The settings schema

`dpfgui/env_schema.yaml` is a machine-readable description of the openshift-dpf automation repo's
settings:

- **`parameters`:** every setting in `ci/env.template`: what it does, its type, allowed values, unit,
  default, when it's required, and whether it's deprecated.
- **`not_templated`:** settings the scripts read but `make generate-env` can't carry.
- **`removed`:** settings that were dropped, why, and what replaces them.

The app takes all of its setting descriptions, choices and format checks from this file. It lives
here for now. If the automation repo ever ships its own `ci/env.schema.yaml`, the app uses that one
instead. `DPFGUI_ENV_SCHEMA=<path>` overrides both, which is handy while editing.

When the automation repo changes, check that the schema still matches it:

```sh
.venv/bin/python -m dpfgui.check_schema ~/repos/openshift-dpf
```

## Where things live

| What | Path | Override |
| --- | --- | --- |
| Profiles (hypervisor, settings; can hold BMC passwords, so mode 0600) | `~/.config/dpf-dev/profiles/<name>.json` | `DPFGUI_CONFIG_DIR` / `XDG_CONFIG_HOME` |
| Fetched kubeconfigs | `~/.kube/dpf-dev/<name>/{mgmt,hcp}.kubeconfig` | `DPFGUI_KUBECONFIG_DIR` |
| Fetch bookkeeping (last error, auto-fetch marker) | `~/.local/state/dpf-dev/` | `DPFGUI_STATE_DIR` / `XDG_STATE_HOME` |

Old `base.env` / `<name>.env` files are converted automatically on first start (comments become notes,
commented-out lines become switched-off settings) and kept as `*.migrated`. The old shared base
(`base.json`) is folded into every profile, the profile's own values winning, and kept as
`base.json.migrated`.
