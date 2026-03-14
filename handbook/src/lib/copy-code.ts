export function addCopyButtons(container: HTMLElement): void {
	const blocks = container.querySelectorAll('pre')
	for (const pre of blocks) {
		if (pre.querySelector('.copy-btn')) continue

		const wrapper = document.createElement('div')
		wrapper.className = 'relative group'
		pre.parentNode?.insertBefore(wrapper, pre)
		wrapper.appendChild(pre)

		const btn = document.createElement('button')
		btn.className =
			'copy-btn absolute right-2 top-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 ' +
			'transition-opacity bg-navy-light text-text-muted hover:text-teal border border-navy-border font-sans'
		btn.textContent = 'Copy'
		btn.addEventListener('click', () => {
			const code = pre.querySelector('code')?.textContent ?? ''
			navigator.clipboard.writeText(code)
			btn.textContent = 'Copied!'
			setTimeout(() => (btn.textContent = 'Copy'), 2000)
		})
		wrapper.appendChild(btn)
	}
}
