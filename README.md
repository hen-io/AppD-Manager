<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="banner.png">
    <img src="banner.png" alt="AppD-Manager" height="100%">
  </picture>
</p>

# Easily create standalone applications for webapps on your *nix system on wayland!

## Installation

### Fedora (dnf)

```sh
sudo dnf config-manager addrepo --from-repofile=https://raw.githubusercontent.com/hen-io/AppD-Manager/HEAD/appd-manager.repo
sudo dnf install appd-manager
```

### Debian, Ubuntu (apt)

```sh
sudo curl -fsSLo /etc/apt/sources.list.d/appd-manager.list https://raw.githubusercontent.com/hen-io/AppD-Manager/HEAD/appd-manager.list
sudo apt update
sudo apt install appd-manager
```

### Any other distribution

Installs for your user only, without root:

```sh
curl -fsSL https://raw.githubusercontent.com/hen-io/AppD-Manager/HEAD/install.sh | bash
```

Then start **AppD-Manager** from the application menu, or run `appd`.
