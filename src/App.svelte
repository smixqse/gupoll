<script>
  import { gun, SEA, peers } from "./beforeload.js";

  var clipboard = new ClipboardJS(".copy");

  document.title = "Gupoll";
  var editMode =
    location.hash.length > 1 && !location.hash.startsWith("#clone/")
      ? false
      : true;
  var hash = location.hash.slice(1) || "";
  var owner =
    hash.length > 1 &&
    !hash.startsWith("#clone/") &&
    localStorage[hash] !== undefined;
  var voted = false;
  var voteDidntCount = false;
  var globalUser = {};
  var clickedMainButton = false;

  var poll = {};

  if (editMode)
    poll = {
      name: "",
      desc: "",
      opts: {
        abcde: "",
        abcdf: ""
      }
    };

  var results = {};
  var totalVotes = 0;
  var acceptedVotes = [];
  $: winningPercentage = Object.keys(results).find(
    a => results[a] === Math.max(...Object.values(results))
  );

  if (localStorage["gun/"]) delete localStorage["gun/"];

  // When it loads...
  (async function() {
    if (!editMode) {
      let user = gun.user(
        (await gun
          .get("gupoll#<?604800")
          .get(location.hash.slice(1))
          .promOnce()).data
      );
      if (localStorage[hash]) {
        user = gun.user();
        user.auth(JSON.parse(localStorage[hash]));
      }
      globalUser = user;
      poll.name = (await user.get("name").promOnce()).data;
      poll.desc = (await user.get("desc").promOnce()).data;
      poll.opts = {};
      user
        .get("opts")
        .map()
        .once(function(data, key) {
          poll.opts[key] = data;
        });
      for (var i in poll.opts) {
        results[key] = 0;
      }

      user
        .get("votes")
        .map()
        .on(function(data, key) {
          results[key] = data;
          console.log(results);
          totalVotes =
            Object.values(results).reduce((acc, prev) => acc + prev) || 0;
          if (owner)
            setTimeout(() => {
              voted = true;
              showVotes();
            }, 700);
          voteDidntCount = false;
          if (!owner && voted)
            setTimeout(() => {
              showVotes();
            }, 500);
        });
      user
        .get("acceptedVotes")
        .map()
        .once(function(data, key) {
          if (data === true) acceptedVotes.push(key);
        });
      if (owner) {
        gun
          .get(`gunote@${hash}/votes#<?604800`)
          .map()
          .on(async function(data, key) {
            if (acceptedVotes.includes(key)) return;
            user
              .get("votes")
              .get(JSON.parse(data).opt)
              .put(results[JSON.parse(data).opt] + 1);
            results[JSON.parse(data).opt] += 1;
            await user
              .get("acceptedVotes")
              .get(key)
              .promPut(true);
          });
      }
    } else if (location.hash.startsWith("#clone/")) {
      (async () => {
        poll = {};
        var pollHash = location.hash.slice(7);
        var user = gun.user(
          (await gun
            .get("gupoll#<?604800")
            .get(pollHash)
            .promOnce()).data
        );
        setTimeout(async () => {
          poll.name = (await user.get("name").promOnce()).data;
          poll.desc = (await user.get("desc").promOnce()).data;
          poll.opts = {};
          user
            .get("opts")
            .map()
            .once(function(data, key) {
              poll.opts[key] = data;
            });
          location.hash = "";
        }, 1000);
      })();
    }
  })();

  function genKey() {
    var chars = "abcdefghijklmnopqrstuvwxyz".split("");
    var key = "";
    for (var i = 0; i < 5; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
  }

  function keyDownOpt(e) {
    if (e.target.textContent.length > 30 && !e.ctrlKey && e.which !== 8)
      e.preventDefault();
  }

  function newOpt(e) {
    var key = genKey();
    poll.opts[key] = "";
  }

  function delOpt(key) {
    delete poll.opts[key];
    poll = poll;
    if (Object.values(poll.opts).length < 1) newOpt();
    //document.querySelector("html").style.setProperty("--theme-color", "green");
  }

  async function submit() {
    if (clickedMainButton) return;
    if (poll.name.length < 1) {
      document.querySelector("#pollName").focus();
      alert("Poll name missing.");
      return;
    }
    if (poll.desc.length < 1) {
      document.querySelector("#pollDesc").focus();
      alert("Poll description missing.");
      return;
    }
    clickedMainButton = true;
    var pollCopy = poll;
    pollCopy.votes = {};
    var a = setTimeout(() => {
      alert(
        "Something went wrong. Try refreshing the page and submitting again."
      );
      clickedMainButton = false;
    }, 8000);
    for (var i in pollCopy.opts) {
      pollCopy.votes[i] = 0;
    }
    const pair = await SEA.pair();
    const user = gun.user();
    user.auth(pair);
    await user.promPut(pollCopy);
    const hash = await SEA.work(pair.pub, null, null, { name: "SHA-256" });
    await gun
      .get(`gupoll#<?604800`)
      .get(hash)
      .promPut(pair.pub);
    localStorage[hash] = JSON.stringify(pair);
    location.hash = hash;
    clearTimeout(a);
    setTimeout(() => {
      location.reload(true);
    }, 500);
  }

  async function vote(key) {
    if (editMode) return;
    if (voted) return;
    var saveVotes = totalVotes;
    voteDidntCount = true;
    setTimeout(() => {
      try {
        document.querySelector("#deliveredVote").textContent =
          "poll owner is offline";
        if (!voteDidntCount) return;
        voteDidntCount = false;
        gun
          .get(`gunote@${hash}/votes#<?604800`)
          .map()
          .once(async function(data, key) {
            if (acceptedVotes.includes(key)) return;
            results[JSON.parse(data).opt] += 1;
            acceptedVotes.push(key);
            totalVotes =
              Object.values(results).reduce((acc, prev) => acc + prev) || 0;
            showVotes();
          });
      } catch (e) {}
    }, 5000);
    var vote = JSON.stringify({
      opt: key,
      numb: Math.floor(Math.random() * 99999)
    });
    var voteHash = await SEA.work(vote, null, null, { name: "SHA-256" });
    await gun
      .get(`gunote@${hash}/votes#<?604800`)
      .get(voteHash)
      .promPut(vote);
    voted = true;
    localStorage["voted"] = (localStorage["voted"] || "") + "," + hash;
    document.activeElement.blur();
    showVotes();
  }

  function showVotes() {
    for (var i in results) {
      var totalVotes = Object.values(results).reduce((acc, pre) => acc + pre);
      var max = Math.max(...Object.values(results));
      var elem = document.querySelector(`[data-key=${i}]`);
      if (elem !== null)
        var perc =
          (results[i] / totalVotes) * 100 || (totalVotes > 0 ? 0 : 100);
      if (elem !== null) elem.style.width = perc + "%";
      if (elem.querySelector(".optPercentage") !== null)
        elem.querySelector(".optPercentage").textContent =
          Math.round(perc) + "%";
    }
  }

  function copy() {
    alert("Copied poll link");
  }

  async function deletePoll() {
    if (clickedMainButton) return;
    clickedMainButton = true;
    console.log(globalUser);
    await globalUser.get("opts").promPut(null);
    await globalUser.get("votes").promPut(null);
    await globalUser.get("name").promPut(null);
    delete localStorage[globalUser.is.pub];
    await globalUser.delete();
    location.hash = "";
    setTimeout(() => {
      location.reload(true);
    }, 500);
  }

  function clonePoll() {
    if (clickedMainButton) return;
    clickedMainButton = true;
    location.hash = `clone/${hash}`;
    location.reload(true);
  }

  setTimeout(() => {
    if (
      !owner &&
      !editMode &&
      !voted &&
      localStorage["voted"] &&
      localStorage["voted"].includes(hash)
    ) {
      voted = true;
      showVotes();
    }
  }, 1000);
</script>

<style>
  #pollMain {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: "Quicksand";
    max-width: 90vw;
  }

  #pollName {
    font-size: clamp(25px, 8vw, 60px);
    font-family: inherit;
    border: none;
    outline: none;
    max-width: 100%;
    padding: 0 0;
    font-weight: 600;
    background: none;
    color: inherit;
  }

  #pollDesc {
    margin: 15px 0;
    outline: none;
    border: none;
    font-family: inherit;
    max-width: 100%;
    font-size: clamp(10px, 5vw, 30px);
  }

  #pollOpts {
    display: flex;
    flex-direction: column;
  }

  .pollOpt {
    min-width: 100px;
    width: auto;
    background-color: var(--theme-color);
    height: clamp(40px, 10vw, 70px);
    margin-bottom: 20px;
    border-radius: 30px;
    outline: none;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .optTxt {
    padding: 0 20px;
    height: 70px;
    line-height: 70px;
    top: 50%;
    font-size: clamp(10px, 5vw, 20px);
    display: inline-block;
    width: clamp(10px, 95vw, 500px);
    min-width: 0;
    flex-grow: 1;
    text-overflow: ellipsis;
    color: var(--dark-bg);
    line-break: strict;
  }

  .optRemove {
    padding-right: 20px;
    height: 100%;
    display: flex;
    align-items: center;
    color: var(--dark-bg);
  }

  [placeholder]:empty::before {
    content: attr(placeholder);
    color: #555;
  }
  input.optTxt {
    font-family: inherit;
    background: none;
    border: none;
    outline: none;
  }

  .optTxt:placeholder {
    color: rgba(0, 0, 0, 0.699);
  }

  #pollOptCreate {
    width: 14px;
    padding: 20px;
    border-radius: 50%;
    height: 14px;
    text-align: center;
    background-color: var(--theme-color);
    margin: 0 auto;
    display: flex;
    cursor: pointer;
    float: left;
  }

  #pollSubmit {
    width: auto;
    padding: 20px;
    border-radius: 30px;
    height: auto;
    text-align: center;
    background-color: var(--theme-color);
    margin: 0 auto;
    display: flex;
    cursor: pointer;
    float: right;
    color: var(--dark-bg);
    font-weight: 600;
  }

  #pollOptCreate i {
    position: relative;
    vertical-align: middle;
    color: var(--dark-bg);
  }

  .optSelect {
    cursor: pointer;
  }

  #voteCount {
    margin-top: 0px;
    margin-bottom: 20px;
    display: inline-block;
    vertical-align: middle;
  }

  #deliveredVote {
    text-align: right;
    float: right;
    font-size: clamp(5px, 4vw, 15px);
  }

  .optPercentage {
    color: var(--dark-bg);
    padding-right: 20px;
  }

  @keyframes rotate {
    from {
      -webkit-transform: rotate(0deg);
    }
    to {
      -webkit-transform: rotate(360deg);
    }
  }
  .loading {
    -webkit-animation-name: rotate;
    -webkit-animation-duration: 3s;
    -webkit-animation-iteration-count: infinite;
    -webkit-transition-timing-function: linear;
    animation-name: rotate;
    animation-duration: 3s;
    animation-iteration-count: infinite;
    transition-timing-function: linear;
  }

  .pollOpt:hover {
    width: 100% !important;
  }

  .winningPercentage {
    font-weight: 700;
    font-size: 25px;
  }

  #pollSubmit:focus,
  #pollOpt:focus,
  #pollOptCreate:focus {
    outline: none;
  }
</style>

{#if poll.opts && Object.keys(poll.opts).length > 0}
  <div id="pollMain">
    <input
      type="text"
      placeholder="poll name"
      disabled={editMode ? false : true}
      bind:value={poll.name}
      id="pollName" />
    {#if editMode}
      <p
        id="pollDesc"
        contenteditable="true"
        placeholder="description"
        bind:textContent={poll.desc} />
    {:else}
      <p id="pollDesc" placeholder="description">{poll.desc}</p>
    {/if}
    <div id="pollOpts">
      {#each Object.entries(poll.opts) as [key, opt] (key)}
        <div
          class="pollOpt"
          id="pollOpt-{key}"
          data-key={key}
          on:click={vote(key)}>
          <input
            type="text"
            class="optTxt {editMode ? '' : 'optSelect'}"
            disabled={editMode ? false : true}
            on:keydown={keyDownOpt}
            maxlength="50"
            bind:value={poll.opts[key]}
            placeholder="poll option" />
          {#if editMode}
            <div class="optRemove" on:click={delOpt(key)}>
              <i class="fas fa-trash" />
            </div>
          {/if}
          {#if !editMode && totalVotes > 0}
            <span
              class="optPercentage{winningPercentage === key ? ' winningPercentage' : ''}" />
          {/if}
        </div>
      {/each}
    </div>
    {#if !editMode && (voted || owner)}
      <span id="voteCount">
        {totalVotes} vote{#if totalVotes !== 1}s{/if}
      </span>
      {#if voteDidntCount}
        <span id="deliveredVote">waiting for the vote to be counted...</span>
      {/if}
    {/if}
    <div id="create">
      {#if editMode}
        <div id="pollOptCreate" on:click={newOpt}>
          <i class="fas fa-plus" />
        </div>
        <div id="pollSubmit" on:click={submit}>
          {#if !clickedMainButton}
            submit
          {:else}
            <i class="fas fa-sync-alt loading" />
          {/if}
        </div>
      {:else}
        <div
          id="pollOptCreate"
          class="copy"
          data-clipboard-text={location.href}
          on:click={copy}>
          <i class="fas fa-share-alt" />
        </div>
        {#if owner}
          <div id="pollSubmit" on:click={deletePoll}>
            {#if !clickedMainButton}
              delete
            {:else}
              <i class="fas fa-sync-alt loading" />
            {/if}
          </div>
        {:else}
          <div id="pollSubmit" on:click={clonePoll}>
            {#if !clickedMainButton}
              clone
            {:else}
              <i class="fas fa-sync-alt loading" />
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
