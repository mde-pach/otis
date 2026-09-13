/** What the tool is, in about ninety seconds. */
export function About() {
	return (
		<div class="doc">
			<div class="col">
				<section>
					<h1>Otis</h1>
					<p class="lead">
						A tool for turning a pile of notes into an article you would actually publish. It
						reorders, shortens and asks about what is missing — but every word in it is yours, and
						what it did to get there is visible on sight.
					</p>
				</section>

				<section>
					<h2>The rule</h2>
					<p>
						<strong>Your text is the source of truth.</strong> Otis never quietly replaces it. What
						it does is put your sections in the order a kind of piece puts them, shorten the ones
						that run long by deleting words, and tell you which parts of that kind your notes do not
						cover. It does not write those parts. It asks you about them, in the gutter, and the
						question comes out of a file you can open and edit.
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
						It comes back with <strong>three kinds of piece</strong> the notes could become, and
						organises the first. Each card describes its kind and nothing else: the name, what that
						kind of piece does, and its parts in the order it puts them, dashed where the piece can
						go without one. It reads the same on every document, because you are choosing a shape
						rather than previewing a result. The one line about your notes is why that kind was
						picked. Choosing another card organises it, once; going back to one you have already
						read costs nothing.
					</p>
					<p>
						Hover any sentence on either side and its counterpart lights up, with the thread between
						them. Every sentence in the article has a thread, because every sentence in the article
						is one of yours.
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
						Down the gutter runs the <strong>spine</strong>: the part of the chosen kind that each
						of your sections is serving, marked where that part begins. It is worth reading. Otis is
						not always right when it says a part is missing — a neighbouring section tends to slide
						into the hole — but it is never wrong about what is filling a part, so the spine is how
						you catch a paragraph standing in for one it is not.
					</p>
					<p>
						<strong>copy markdown</strong>, at the top of the article, puts the whole thing on your
						clipboard as plain Markdown. Your words, no marks, ready to paste wherever you are
						publishing.
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
							<span class="sw k-written">a question, in amber</span>
							<span>
								a part of this kind of piece that none of your sections went into. The words are the
								pattern file's; nothing is written into the article
							</span>
						</div>
						<div>
							<span class="sw k-reworded">a question, in cyan</span>
							<span>
								a part something <em>was</em> put in, that does not do its job — a cost with no
								figure, a state with no date. Only parts that owe something checkable are asked
							</span>
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
							<span>
								puts your sections in the order this kind of piece puts them, and names what it
								leaves out.
							</span>
						</div>
						<div>
							<b>and ask</b>
							<span>
								all of the above, and asks you about the parts your notes do not cover. It never
								fills one.
							</span>
						</div>
					</div>
				</section>

				<section>
					<h2>Where the judgement comes from</h2>
					<p>
						A kind of piece is a file: a list of parts, each one marked required or not, and each
						one carrying the question you are asked when nothing of yours goes into it. The model is
						never asked to respect that file. It is asked one question — which part does this
						section belong to — and the answer is checked against the file before anything is used;
						the order is the file's and is computed, and the questions are printed from it word for
						word. Those files live in the repository, versioned with the code. When one gives bad
						results you edit it rather than guess at a prompt.
					</p>
				</section>

				<section>
					<h2>What it will not do</h2>
					<p>
						A shortening may only delete: every word in it has to be a word your sentence already
						contains, so a clause that reads well and was never yours cannot survive the gate, and
						neither can a number or unit your notes do not have. It will not choose the order — that
						belongs to the pattern file and is computed here. It will not fill a part you left
						empty. It will not call out to a model unless you press run. And there is no field in
						what comes back that its own prose could arrive in, which is why nothing in your article
						needs a colour for it.
					</p>
				</section>

				<p class="foot">Everything stays in this browser. Your notes, your key, your drafts.</p>
			</div>
		</div>
	);
}
