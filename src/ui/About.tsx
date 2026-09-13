/** What the tool is, in about ninety seconds. */
export function About() {
	return (
		<div class="doc">
			<div class="col">
				<section>
					<h1>Otis</h1>
					<p class="lead">
						A tool for turning a pile of notes into an article you would actually publish. It
						reorders, shortens and fills in — but the writing stays yours, and every word that is
						not yours is visible on sight.
					</p>
				</section>

				<section>
					<h2>The rule</h2>
					<p>
						<strong>Your text is the source of truth.</strong> Otis never quietly replaces it. What
						it does is move your sentences into an order that reads, shorten the ones that run long,
						and — when you let it — write the parts your notes never covered. Each of those is a
						different colour on the page, so you can see which is which without asking.
					</p>
				</section>

				<section>
					<h2>How to use it</h2>
					<p>
						Write or paste on the left. The article appears on the right straight away, in your own
						order, untouched. Say what you are making in the line at the bottom — in your own words,
						not from a menu — and press <strong>run</strong>.
					</p>
					<p>
						Nothing reaches the model on its own. Typing, moving the dial and rewriting the brief
						are all free; only <strong>run</strong> spends a request, and one request answers all
						four reach settings, so you can read your text four ways without asking again. When you
						have edited since the last run, the button says <em>run again</em>.
					</p>
					<p>
						It comes back with <strong>two or three arrangements</strong>, not one, and applies the
						first. The others are already paid for, so the strip above the article lets you move
						between them for nothing. Each one is laid out in full: what it leads with, why it is
						in that order, and the piece it would make — every section by its opening words,
						numbered by where it sits in your notes, with anything it would leave out named rather
						than silently missing. Nothing is behind a hover. You are choosing the shape of your
						article, so you get to read all three before you say which.
					</p>
					<p>
						Hover any sentence on either side and its counterpart lights up, with the thread between
						them. A sentence with no thread came from nowhere in your notes: it is something Otis
						wrote.
					</p>
					<p>
						The piece it moves is a <strong>section of your document</strong>, exactly as you
						separated it: a block between blank lines, a bullet, a heading. If you typed the whole
						thing on one line there is nothing to separate, so its sentences are the sections
						instead. There is no paragraph model underneath — a section goes in and a section comes
						out, and the layout is the Markdown in your own text.
					</p>
					<p>
						Hover a shortened sentence and what it did opens <strong>in the gutter</strong>, on that
						sentence's own thread: your words struck through where they went, its words beside them.
						It sits between the two texts because it belongs to neither — your notes are your notes
						and the article is the article, and nothing about what happened between them is written
						into either. Below 880px the gutter is gone, and the card with it.
					</p>
					<p>
						<strong>copy markdown</strong>, at the top of the article, puts the whole thing on your
						clipboard as plain Markdown. Your words and its own, no marks, ready to paste wherever
						you are publishing.
					</p>
				</section>

				<section>
					<h2>What the colours mean</h2>
					<div class="key">
						<div>
							<span class="sw k-yours">your words</span>
							<span>exactly as you wrote them, wherever they now sit</span>
						</div>
						<div>
							<span class="sw k-reworded">shortened</span>
							<span>your sentence, fewer words — no number or claim changed</span>
						</div>
						<div>
							<span class="sw k-written">written by Otis</span>
							<span>not in your notes at all; edit it and it becomes yours</span>
						</div>
						<div>
							<span class="sw k-low">a long reach</span>
							<span>written, and further from what your notes support — read these first</span>
						</div>
						<div>
							<span class="sw k-out">dimmed, on the left</span>
							<span>something you wrote that the article is not using</span>
						</div>
					</div>
					<p class="after">
						Formatting is not rewriting. Otis may bold a figure, make a list or add a heading and
						the words stay marked as yours, because they <em>are</em> yours — only different words
						count as a change.
					</p>
				</section>

				<section>
					<h2>Reach</h2>
					<p>
						The dial sets how much licence it has. The brief says what the piece is; this says how
						far it may go to get there.
					</p>
					<div class="steps">
						<div>
							<b>as written</b>
							<span>your text, your order. Nothing is touched, and no key is needed.</span>
						</div>
						<div>
							<b>tidy</b>
							<span>shortens sentences that run long. Keeps your order, writes nothing.</span>
						</div>
						<div>
							<b>reorder</b>
							<span>moves things, and drops what does not earn its place.</span>
						</div>
						<div>
							<b>rebuild</b>
							<span>all of the above, and writes what is missing.</span>
						</div>
					</div>
				</section>

				<section>
					<h2>Where the judgement comes from</h2>
					<p>
						Otis reads a short reference note for the kind of piece you asked for — a few dozen
						words on how a post-mortem or an internal note tends to move. Those notes live in the
						repository as plain Markdown, versioned with the code. When one gives bad results you
						edit a file rather than guess at a prompt.
					</p>
				</section>

				<section>
					<h2>What it will not do</h2>
					<p>
						It will not invent a number, a unit or an identifier your notes do not contain — a
						shortening that introduces one is discarded before you ever see it. It will not say
						again in its own words what you already wrote: a draft that mostly repeats one of your
						sections is a restatement, not a gap, and is dropped. It will not silently replace your
						sentence with its own, and it will not call out to a model unless you press run. And it
						will not hide what it did: the only way a word of its writing reaches your article is in
						amber.
					</p>
				</section>

				<p class="foot">Everything stays in this browser. Your notes, your key, your drafts.</p>
			</div>
		</div>
	);
}
