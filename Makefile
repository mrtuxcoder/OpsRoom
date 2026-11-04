.PHONY: install start-mock chaos recover health logs remediate report test-flow watch clean

install:
	npm install

start-mock:
	npm run start:mock

chaos:
	npm run chaos

recover:
	npm run chaos:recover

health:
	npm run check:health

logs:
	npm run inspect:logs

remediate:
	node src/tools/run-remediation.js --token 101 --action restart

report:
	npm run report

watch:
	npm run watch

# Automated End-to-End Simulation Test
test-flow:
	@echo "=== 1. Starting Initial Health Check (Expected Healthy) ==="
	-npm run check:health
	@echo "\n=== 2. Injecting Chaos (Crashing target to 502) ==="
	npm run chaos
	@echo "\n=== 3. Sentinel Detecting Failure ==="
	-npm run check:health
	@echo "\n=== 4. Investigator Inspecting Logs ==="
	npm run inspect:logs
	@echo "\n=== 5. Human Approving Remediation (#101) ==="
	node src/tools/run-remediation.js --token 101 --action restart
	@echo "\n=== 6. Sentinel Verifying Recovery ==="
	npm run check:health
	@echo "\n=== 7. Investigator Generating Post-Mortem Artifact ==="
	npm run report
	@echo "\n✅ Full E2E Incident Response Flow Verified Successfully!"

clean:
	rm -rf artifacts/*.md
