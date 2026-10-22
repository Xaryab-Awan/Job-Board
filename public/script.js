const container = document.getElementById("ads");

      async function loadAds() {
        const res = await fetch("/api/ads");
        const ads = await res.json();

        ads.forEach((ad) => {
          const div = document.createElement("div");
          div.className = "ad";
          div.innerHTML = `
          <h2>${ad.title}</h2>
          <p>${ad.short_description}</p>
          <button class="learn">Learn more</button>
          <button class="apply">Apply</button>
          <div class="details"></div>
        `;

          const details = div.querySelector(".details");
          details.hidden = true;

          div.querySelector(".learn").addEventListener("click", async () => {
            if (!details.hidden) {
              details.hidden = true;
              return;
            }
            const r = await fetch("/api/ads/" + ad.id);
            const full = await r.json();
            details.innerHTML = `
            <p>${full.full_description}</p>
            <p><b>Company:</b> ${full.company_name}</p>
            <p><b>Wage:</b> ${full.wage}</p>
            <p><b>Location:</b> ${full.location}</p>
            <p><b>Working time:</b> ${full.working_time}</p>
          `;
            details.hidden = false;
          });

          container.appendChild(div);
        });
      }

      loadAds();