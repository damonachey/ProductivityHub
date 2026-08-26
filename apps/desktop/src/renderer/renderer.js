const list = document.getElementById("repos");

window.api
  .listRepos()
  .then((repos) => {
    for (const repo of repos) {
      const item = document.createElement("li");
      item.textContent = `${repo.name} (${repo.private ? "private" : "public"}) — updated ${repo.updatedAt}`;
      list.appendChild(item);
    }
  })
  .catch((err) => {
    const item = document.createElement("li");
    item.textContent = `Error: ${err.message ?? err}`;
    list.appendChild(item);
  });
