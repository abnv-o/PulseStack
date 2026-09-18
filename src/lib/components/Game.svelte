<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { GameEngine, type HudState } from '$lib/game/engine';
	import { appVersionLabel, Cap } from '$lib/game/platform';
	import { env } from '$env/dynamic/public';

	let stageEl: HTMLElement;
	let canvasEl: HTMLCanvasElement;
	let nameInput = '';
	let engine: GameEngine | null = null;

	let hud: HudState = {
		score: 0,
		best: 0,
		streakText: '',
		dayStreak: '',
		coachOn: false,
		sheet: 'start',
		name: '',
		shape: 'ghost',
		sound: true,
		vers: 'web',
		over: {
			final: 0,
			headline: 'The tower is a thread.',
			delta: '',
			peakPct: 0,
			maxStreak: 0,
			feverLabel: '—',
			unlockNote: '',
			board: '',
			shareOn: false
		},
		lb: { title: 'Leaderboard', modeLabel: 'Daily', entries: [], pidShort: '' }
	};

	function mergeHud(patch: Partial<HudState>) {
		hud = {
			...hud,
			...patch,
			over: patch.over ? { ...hud.over, ...patch.over } : hud.over,
			lb: patch.lb ? { ...hud.lb, ...patch.lb } : hud.lb
		};
		if (patch.name !== undefined) nameInput = patch.name;
	}

	onMount(() => {
		engine = new GameEngine({
			getCanvas: () => canvasEl,
			getStage: () => stageEl,
			getEl: (id) => document.getElementById(id),
			onHud: mergeHud,
			getName: () => nameInput
		});
		engine.init();
		mergeHud({
			vers: Cap.isNative ? 'v' + (env.PUBLIC_APP_VERSION || '1.0.0') : appVersionLabel()
		});

		const onKey = (e: KeyboardEvent) => {
			if (!e.isTrusted || !engine) return;
			if (e.code === 'Escape') {
				engine.isPaused ? engine.resume() : engine.pause();
				return;
			}
			if (e.code !== 'Space' || (e.target as HTMLElement).tagName === 'INPUT') return;
			e.preventDefault();
			if (!engine.startHidden) engine.begin('endless');
			else if (!engine.overHidden) engine.again();
			else if (!engine.isPaused) engine.tap();
		};
		addEventListener('keydown', onKey);
		window.onBack = () => engine?.onBack() ?? false;

		let removeBack: (() => void) | undefined;
		(async () => {
			if (!Cap.isNative) return;
			try {
				const { App } = await import('@capacitor/app');
				const { StatusBar, Style } = await import('@capacitor/status-bar');
				await StatusBar.setStyle({ style: Style.Dark });
				await StatusBar.setBackgroundColor({ color: '#070A12' });
				const sub = await App.addListener('backButton', ({ canGoBack }) => {
					if (engine?.onBack()) return;
					if (!canGoBack) App.exitApp();
				});
				removeBack = () => sub.remove();
			} catch {
				/* web preview */
			}
		})();

		if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
		}

		return () => {
			removeEventListener('keydown', onKey);
			removeBack?.();
			engine?.destroy();
			window.onBack = undefined;
		};
	});
</script>

<div id="stage" bind:this={stageEl}>
	<canvas
		id="c"
		bind:this={canvasEl}
		onpointerdown={(e) => {
			e.preventDefault();
			if (e.isTrusted) engine?.tap();
		}}
	></canvas>

	<div class="hud">
		<div>
			<div class="n">{hud.score}</div>
			<small>height</small>
			<small class="streak">{hud.streakText}</small>
		</div>
		<div style="display:flex;gap:12px;align-items:flex-start">
			<div>
				<div class="best">{hud.best}</div>
				<small>best</small>
			</div>
			<button type="button" id="menuBtn" aria-label="Menu" onclick={() => engine?.pause()}
				>&#9776;</button
			>
		</div>
	</div>

	<div class="coach" id="coach">Tap at the peak</div>

	<div class="overlay" id="start">
		<div class="homeTop">
			<h1>Pulse<span>Stack</span></h1>
			<p class="tag">Tap the peak. Stack thinner with every miss.</p>
			<div class="dayStreak" id="dayStreak">{hud.dayStreak}</div>
		</div>
		<div class="homeMid">
			<canvas
				id="pulsePrev"
				width="112"
				height="112"
				aria-label="Pulse preview"
				onclick={() => engine?.showOptions()}
			></canvas>
			<input
				id="name"
				placeholder="your name"
				maxlength="12"
				autocomplete="off"
				bind:value={nameInput}
				oninput={() => engine?.setName(nameInput)}
			/>
			<button type="button" id="go" onclick={() => engine?.begin('endless')}>Start</button>
			<button type="button" class="ghost" id="daily" onclick={() => engine?.begin('daily')}>Daily</button>
		</div>
		<div class="homeBar">
			<button type="button" id="lbBtn" onclick={() => engine?.showLb('start')}>Board</button>
			<button type="button" id="optBtn" onclick={() => engine?.showOptions()}>Pulse</button>
			<div class="vers" id="vers">{hud.vers}</div>
		</div>
	</div>

	<div class="overlay" id="options">
		<h2>The pulse</h2>
		<p>Two ways to read the same beat. Pick the one that clicks for you.</p>
		<div class="opts" id="opts"></div>
		<label class="toggle">
			<input
				type="checkbox"
				id="snd"
				checked={hud.sound}
				onchange={(e) => engine?.setSound((e.currentTarget as HTMLInputElement).checked)}
			/>
			<span>Sound <b id="sndV">{hud.sound ? 'on' : 'off'}</b></span>
		</label>
		<button type="button" id="optDone" onclick={() => engine?.hideOptions()}>Done</button>
	</div>

	<div class="overlay" id="over">
		<div class="big" id="final">{hud.over.final}</div>
		<h2 id="headline">{hud.over.headline}</h2>
		<p class="delta" id="delta">{hud.over.delta}</p>
		<div class="stats" id="stats">
			<div>Peak<b>{hud.over.peakPct}%</b></div>
			<div>Max streak<b>×{hud.over.maxStreak}</b></div>
			<div>Fever<b>{hud.over.feverLabel}</b></div>
		</div>
		<p class="unlockNote" id="unlockNote">{hud.over.unlockNote}</p>
		<p class="board" id="board">{hud.over.board}</p>
		<button type="button" id="again" onclick={() => engine?.again()}>Again</button>
		<div class="overBar">
			<button type="button" id="share" class:on={hud.over.shareOn} onclick={() => engine?.share()}
				>Share</button
			>
			<button type="button" id="lbBtn2" onclick={() => engine?.showLb('over')}>Board</button>
			<button type="button" id="optBtn2" onclick={() => engine?.showOptions()}>Pulse</button>
		</div>
	</div>

	<div class="overlay" id="lb">
		<h2 id="lbTitle">{hud.lb.title}</h2>
		<ol id="lbList">
			{#if hud.lb.entries.length === 0}
				<li><span>No runs yet</span></li>
			{:else}
				{#each hud.lb.entries as e, i}
					<li class:me={e.id === hud.lb.pidShort}>
						<span
							>{i + 1}. {e.name.replace(/[<>&]/g, '')} <small>#{e.id}</small></span
						>
						<b>{e.n}</b>
					</li>
				{/each}
			{/if}
		</ol>
		<div class="row">
			<button type="button" class="ghost" id="lbMode" onclick={() => engine?.toggleLbMode()}
				>{hud.lb.modeLabel}</button
			>
			<button type="button" id="lbDone" onclick={() => engine?.hideLb()}>Back</button>
		</div>
	</div>

	<div class="overlay" id="menu">
		<h2>Paused</h2>
		<button type="button" id="resume" onclick={() => engine?.resume()}>Resume</button>
		<div class="row">
			<button type="button" class="ghost" id="restart" onclick={() => engine?.restart()}>Restart</button>
			<button type="button" class="ghost" id="optBtn3" onclick={() => engine?.showOptions()}
				>Pulse</button
			>
			<button type="button" class="ghost" id="quit" onclick={() => engine?.quit()}>Quit</button>
		</div>
	</div>
</div>
