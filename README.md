<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="banner.png">
    <img src="banner.png" alt="AppD-Manager" height="100%">
  </picture>
</p>

# Easily create standalone applications for webapps on your *nix system on wayland!

## Installation

### DNF Package Manager - Fedora, Bazzite, RHEL

```sh
sudo dnf config-manager addrepo --from-repofile=https://raw.githubusercontent.com/hen-io/AppD-Manager/HEAD/appd-manager.repo
sudo dnf install appd-manager
```

### Apt Package manager - Debian, Ubuntu

```sh
sudo curl -fsSLo /etc/apt/sources.list.d/appd-manager.list https://raw.githubusercontent.com/hen-io/AppD-Manager/HEAD/appd-manager.list
sudo apt update
sudo apt install appd-manager
```

### Pacman Package Manager - Arch, CachyOS, EndeavourOS, Manjaro

```sh
curl -fsSL https://raw.githubusercontent.com/hen-io/AppD-Manager/HEAD/appd-manager.pacman.conf | sudo tee -a /etc/pacman.conf
sudo pacman -Sy appd-manager
```

### Windows (64-bit)

1. Download `AppD-Manager_v_<version>_windows_x64.zip` from the [latest release](https://github.com/hen-io/AppD-Manager/releases/latest).
2. Unpack it to a folder of your own, for example `C:\Users\<you>\AppD-Manager`.
3. Start `AppD-Manager.exe`.

AppD-Manager and the apps you add get shortcuts in the Start menu, in the folder **AppD-Manager**.

### Any other distribution

Installs for your user only, without root:

```sh
curl -fsSL https://raw.githubusercontent.com/hen-io/AppD-Manager/HEAD/install.sh | bash
```

Then start **AppD-Manager** from the application menu, or run `appd`.
