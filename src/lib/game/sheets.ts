const SHEET_MS = 200;

export function prefersReducedMotion(): boolean {
	return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function showSheet(el: HTMLElement | null) {
	if (!el) return;
	el.classList.remove('is-out');
	el.hidden = false;
}

export function hideSheet(el: HTMLElement | null): Promise<void> {
	return new Promise((resolve) => {
		if (!el || el.hidden) {
			resolve();
			return;
		}
		if (prefersReducedMotion()) {
			el.hidden = true;
			el.classList.remove('is-out');
			resolve();
			return;
		}
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			el.removeEventListener('transitionend', onEnd);
			el.hidden = true;
			el.classList.remove('is-out');
			resolve();
		};
		const onEnd = (e: TransitionEvent) => {
			if (e.target !== el || e.propertyName !== 'opacity') return;
			finish();
		};
		el.addEventListener('transitionend', onEnd);
		requestAnimationFrame(() => el.classList.add('is-out'));
		setTimeout(finish, SHEET_MS);
	});
}

export function setCoach(el: HTMLElement | null, on: boolean) {
	if (!el) return;
	if (on) {
		el.hidden = false;
		requestAnimationFrame(() => el.classList.add('is-on'));
		return;
	}
	if (el.hidden && !el.classList.contains('is-on')) return;
	el.classList.remove('is-on');
	if (prefersReducedMotion()) {
		el.hidden = true;
		return;
	}
	let done = false;
	const finish = () => {
		if (done) return;
		done = true;
		el.removeEventListener('transitionend', onEnd);
		el.hidden = true;
	};
	const onEnd = (e: TransitionEvent) => {
		if (e.target !== el || e.propertyName !== 'opacity') return;
		finish();
	};
	el.addEventListener('transitionend', onEnd);
	setTimeout(finish, 250);
}
